"""Pruebas del examen diagnóstico (RF-22, RN-22) y de las predicciones que genera (RN-06, RN-07)."""
from tests.conftest import auth


def _responder_todo(client, token, elegir):
    """Inicia el examen y responde cada pregunta con la opción que devuelve `elegir(opciones)`."""
    estado = client.post('/api/diagnostic/start', headers=auth(token)).json()
    while estado['pregunta']:
        opcion = elegir(estado['pregunta']['opciones'])
        r = client.post('/api/diagnostic/answers', json={'opcion_id': opcion['id']}, headers=auth(token))
        assert r.status_code == 200, r.text
        estado = r.json()
    return estado


def test_estado_inicial_y_pregunta_sin_respuestas(client, registrar):
    u = registrar()
    assert client.get('/api/diagnostic', headers=auth(u['token'])).json() == {
        'examen': None, 'pregunta': None, 'resultado': None}

    estado = client.post('/api/diagnostic/start', headers=auth(u['token'])).json()
    assert (estado['examen']['respondidas'], estado['examen']['total']) == (0, 15)
    p = estado['pregunta']
    assert p['orden'] == 1
    assert len(p['opciones']) == 4
    # No revela puntuaciones ni señales de alerta.
    assert all(set(o) == {'id', 'texto'} for o in p['opciones'])
    assert 'senales' not in p['contenido']

    # Iniciar de nuevo continúa el mismo examen.
    otra = client.post('/api/diagnostic/start', headers=auth(u['token'])).json()
    assert otra['examen']['id'] == estado['examen']['id']


def test_examen_completo_genera_predicciones(client, registrar):
    u = registrar()
    # Elige siempre la primera opción.
    final = _responder_todo(client, u['token'], lambda ops: ops[0])
    assert final['examen']['estado'] == 'finalizado'
    assert final['pregunta'] is None
    res = final['resultado']
    assert len(res['respuestas']) == 15
    r1 = res['respuestas'][0]
    assert r1['subcategoria'] == 'suplantacion_empresa'
    assert r1['puntuacion'] == 0.0  # pagar en el enlace es la opción crítica
    assert r1['opcion_segura'].startswith('Reviso el estado del envío')
    assert r1['senales']

    m = client.get(f"/api/users/{u['usuario']['id']}/metrics", headers=auth(u['token'])).json()
    pred = {p['subcategoria']: p for p in m['predicciones']}
    assert len(pred) == 15
    assert (pred['suplantacion_empresa']['puntaje_esperado'], pred['suplantacion_empresa']['probabilidad_error']) == (0.0, 1.0)
    assert pred['suplantacion_persona_conocida']['probabilidad_error'] == 0.0  # su primera opción es la segura
    assert all(p['modelo_id'] is None for p in m['predicciones'])  # criterio del baseline
    # Ordenadas de mayor a menor probabilidad de error.
    probs = [p['probabilidad_error'] for p in m['predicciones']]
    assert probs == sorted(probs, reverse=True)


def test_solo_una_vez_y_respuestas_validas(client, registrar):
    u = registrar()
    t = u['token']
    r = client.post('/api/diagnostic/answers', json={'opcion_id': 1}, headers=auth(t))
    assert r.status_code == 409  # sin iniciar

    estado = client.post('/api/diagnostic/start', headers=auth(t)).json()
    segunda = estado['pregunta']['opciones'][0]['id'] + 4  # una opción de otra pregunta
    r = client.post('/api/diagnostic/answers', json={'opcion_id': segunda}, headers=auth(t))
    assert r.status_code == 400

    _responder_todo(client, t, lambda ops: ops[-1])
    r = client.post('/api/diagnostic/start', headers=auth(t))
    assert r.status_code == 409  # RN-22
    assert client.get('/api/diagnostic', headers=auth(t)).json()['resultado'] is not None


def test_simulacion_actualiza_la_prediccion(client, registrar):
    # RN-06: después de una simulación, la predicción de su subcategoría usa ese puntaje.
    u = registrar()
    _responder_todo(client, u['token'], lambda ops: ops[0])
    lista = client.get('/api/scenarios', headers=auth(u['token'])).json()['datos']
    e = next(x for x in lista if x['codigo'] == 'PH-001')
    r = client.post('/api/attempts', json={'escenario_id': e['id']}, headers=auth(u['token']))
    intento_id, paso = r.json()['intento']['id'], r.json()['paso']
    opcion = next(o for o in paso['opciones'] if o['texto'] == 'Ignorar el mensaje')
    client.post(f'/api/attempts/{intento_id}/responses', json={'opcion_id': opcion['id']}, headers=auth(u['token']))
    assert client.post(f'/api/attempts/{intento_id}/finish', headers=auth(u['token'])).json()['resultado']['puntaje'] == 100

    m = client.get(f"/api/users/{u['usuario']['id']}/metrics", headers=auth(u['token'])).json()
    pred = next(p for p in m['predicciones'] if p['subcategoria'] == 'alertas_seguridad_ti')
    assert (pred['puntaje_esperado'], pred['probabilidad_error']) == (1.0, 0.0)
