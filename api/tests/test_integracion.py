"""Pruebas de integración de la API contra un PostgreSQL de pruebas (ver conftest.py)."""
import re

from tests.conftest import auth


def _ph001(client, token):
    lista = client.get('/api/scenarios', headers=auth(token)).json()['datos']
    return next(e for e in lista if e['codigo'] == 'PH-001')


def _recorrer(client, token, escenario_id, textos):
    """Inicia un intento y elige las opciones por su texto; devuelve el intento finalizado."""
    r = client.post('/api/attempts', json={'escenario_id': escenario_id}, headers=auth(token))
    assert r.status_code == 201, r.text
    intento_id, paso = r.json()['intento']['id'], r.json()['paso']
    for texto in textos:
        opcion = next(o for o in paso['opciones'] if o['texto'] == texto)
        r = client.post(f'/api/attempts/{intento_id}/responses', json={'opcion_id': opcion['id']}, headers=auth(token))
        assert r.status_code == 201, r.text
        paso = r.json()['paso']
    assert paso is None
    r = client.post(f'/api/attempts/{intento_id}/finish', headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


# --- Salud y autenticación ----------------------------------------------------

def test_health(client):
    assert client.get('/api/health').json() == {'status': 'ok', 'database': 'ok'}


def test_ruta_inexistente(client):
    r = client.get('/api/no-existe')
    assert r.status_code == 404
    assert r.json()['error']['code'] == 'NOT_FOUND'


def test_registro_login_y_me(client, registrar):
    u = registrar(correo='Ana.Perez@Test.Local')
    assert u['usuario']['correo'] == 'ana.perez@test.local'
    assert 'password_hash' not in u['usuario']

    r = client.post('/api/auth/login', json={'correo': 'ana.perez@test.local', 'password': u['password']})
    assert r.status_code == 200
    me = client.get('/api/auth/me', headers=auth(r.json()['token'])).json()['usuario']
    assert me['id'] == u['usuario']['id']


def test_registro_valida_campos(client):
    r = client.post('/api/auth/register', json={
        'nombre': 'A', 'correo': 'no-es-correo', 'password': 'corta', 'confirmar_password': 'corta'})
    assert r.status_code == 400
    campos = {d['campo'] for d in r.json()['error']['details']}
    assert {'body.nombre', 'body.correo', 'body.password'} <= campos


def test_contrasenas_distintas(client):
    r = client.post('/api/auth/register', json={
        'nombre': 'Ana', 'correo': 'distintas@test.local', 'password': 'Segura123', 'confirmar_password': 'Otra1234',
        'acepta_aviso_privacidad': True, 'mayor_de_edad': True})
    assert r.status_code == 400
    assert r.json()['error']['details'] == [{'campo': 'body.confirmar_password', 'mensaje': 'Las contraseñas no coinciden'}]


def test_correo_duplicado_y_login_incorrecto(client, registrar):
    u = registrar()
    r = client.post('/api/auth/register', json={
        'nombre': 'Otro', 'correo': u['usuario']['correo'], 'password': 'Segura123', 'confirmar_password': 'Segura123',
        'acepta_aviso_privacidad': True, 'mayor_de_edad': True})
    assert r.status_code == 409
    r = client.post('/api/auth/login', json={'correo': u['usuario']['correo'], 'password': 'Incorrecta1'})
    assert r.status_code == 401


def test_sin_token(client):
    r = client.get('/api/auth/me')
    assert r.status_code == 401
    assert r.json()['error']['message'] == 'Falta el token de autenticación'


# --- Usuarios -----------------------------------------------------------------

def test_usuario_no_ve_a_otros_ni_administra(client, registrar):
    a, b = registrar(), registrar()
    assert client.get(f"/api/users/{b['usuario']['id']}", headers=auth(a['token'])).status_code == 403
    assert client.get('/api/users', headers=auth(a['token'])).status_code == 403


def test_cambio_de_password_invalida_sesiones(client, registrar):
    u = registrar()
    r = client.put(f"/api/users/{u['usuario']['id']}", headers=auth(u['token']),
                   json={'password_actual': u['password'], 'password_nueva': 'NuevaClave123'})
    assert r.status_code == 200
    assert client.get('/api/auth/me', headers=auth(u['token'])).status_code == 401
    assert client.get('/api/auth/me', headers=auth(r.json()['token'])).status_code == 200


def test_admin_crea_lista_y_elimina(client, admin):
    r = client.post('/api/users', headers=auth(admin['token']),
                    json={'nombre': 'Creado Admin', 'correo': 'creado@test.local', 'password': 'Segura123'})
    assert r.status_code == 201
    id_ = r.json()['usuario']['id']
    lista = client.get('/api/users', params={'buscar': 'creado@'}, headers=auth(admin['token'])).json()
    assert [u['id'] for u in lista['datos']] == [id_]
    assert client.delete(f'/api/users/{id_}', headers=auth(admin['token'])).status_code == 204
    r = client.post('/api/auth/login', json={'correo': 'creado@test.local', 'password': 'Segura123'})
    assert r.status_code == 403


# --- Escenarios ---------------------------------------------------------------

def test_usuario_ve_resumen_sin_respuestas(client, registrar):
    u = registrar()
    e = _ph001(client, u['token'])
    assert e['mis_intentos'] == 0
    detalle = client.get(f"/api/scenarios/{e['id']}", headers=auth(u['token'])).json()['escenario']
    assert 'pasos' not in detalle


def test_admin_crea_edita_y_valida_escenarios(client, admin):
    doc = {
        'titulo': 'SMS de paquetería', 'subcategoria': 'suplantacion_empresa', 'dificultad': 'basico',
        'descripcion': 'Un SMS dice que tu paquete está retenido.', 'estado': 'activo',
        'senales': [{'clave': 'enlace_corto', 'descripcion': 'Enlace acortado', 'explicacion': 'Oculta el destino real.'}],
        'pasos': [{
            'clave': 'sms', 'titulo': 'Mensaje recibido', 'pregunta': '¿Qué haces?', 'es_inicial': True,
            'contenido': {'formato': 'sms', 'remitente': '5512345678', 'mensaje': 'Tu paquete está retenido.'},
            'opciones': [
                {'clave': 'abrir', 'texto': 'Abrir el enlace', 'tipo_accion': 'riesgosa', 'puntuacion': -10,
                 'retroalimentacion': 'No abras enlaces.'},
                {'clave': 'verificar', 'texto': 'Verificar en el sitio oficial', 'tipo_accion': 'segura', 'puntuacion': 10,
                 'retroalimentacion': 'Correcto.', 'senales': ['enlace_corto']},
            ],
        }],
        'reglas': [{'tipo_regla': 'OPCION_SELECCIONADA', 'parametros': {'opcion': 'abrir'},
                    'ajuste_puntuacion': -5, 'descripcion': 'Abrió el enlace'}],
    }
    r = client.post('/api/scenarios', json=doc, headers=auth(admin['token']))
    assert r.status_code == 201, r.text
    esc = r.json()['escenario']
    assert re.fullmatch(r'SM-\d{3}', esc['codigo'])
    assert (esc['tipo'], esc['subcategoria']) == ('smishing', 'suplantacion_empresa')
    assert esc['pasos'][0]['opciones'][1]['senales'] == ['enlace_corto']

    # Referencia a un paso inexistente → error de estructura
    malo = {**doc, 'pasos': [{**doc['pasos'][0], 'opciones': [
        {**doc['pasos'][0]['opciones'][0], 'siguiente_paso': 'no_existe'}, doc['pasos'][0]['opciones'][1]]}]}
    r = client.put(f"/api/scenarios/{esc['id']}", json=malo, headers=auth(admin['token']))
    assert r.status_code == 400
    assert any('paso inexistente' in d['mensaje'] for d in r.json()['error']['details'])

    r = client.patch(f"/api/scenarios/{esc['id']}", json={'estado': 'inactivo'}, headers=auth(admin['token']))
    assert r.json()['escenario']['estado'] == 'inactivo'
    assert client.delete(f"/api/scenarios/{esc['id']}", headers=auth(admin['token'])).status_code == 204


def test_regla_desconocida(client, admin):
    r = client.post('/api/scenarios', headers=auth(admin['token']), json={
        'titulo': 'X X X', 'subcategoria': 'premio_falso', 'dificultad': 'basico', 'descripcion': 'Desc', 'pasos': [],
        'reglas': [{'tipo_regla': 'INVENTADA', 'parametros': {}, 'descripcion': 'abc'}]})
    assert r.status_code == 400
    mensajes = [d['mensaje'] for d in r.json()['error']['details']]
    assert 'Tipo de regla no válido' in mensajes
    assert 'El escenario necesita al menos un paso' in mensajes


def test_ajuste_de_regla_limitado(client, admin):
    # RN-03: cada regla suma o resta como máximo 10 puntos.
    r = client.post('/api/scenarios', headers=auth(admin['token']), json={
        'titulo': 'X X X', 'subcategoria': 'premio_falso', 'dificultad': 'basico', 'descripcion': 'Desc', 'pasos': [],
        'reglas': [{'tipo_regla': 'TIPO_ACCION_PRESENTE', 'parametros': {'tipo_accion': 'critica'},
                    'ajuste_puntuacion': -15, 'descripcion': 'abc'}]})
    assert r.status_code == 400
    assert any(d['campo'].endswith('ajuste_puntuacion') for d in r.json()['error']['details'])


def test_catalogos_con_subcategorias(client, registrar):
    c = client.get('/api/catalogos', headers=auth(registrar()['token'])).json()
    assert [t['clave'] for t in c['tipos_ataque']] == ['phishing', 'smishing']
    assert len(c['subcategorias']) == 15
    assert sum(s['tipo'] == 'smishing' for s in c['subcategorias']) == 9
    assert 'mejorable' in c['tipos_accion']


# --- Simulación completa, métricas e historial --------------------------------

def test_simulacion_completa(client, registrar):
    u = registrar()
    e = _ph001(client, u['token'])
    fin = _recorrer(client, u['token'], e['id'], ['Abrir el enlace', 'Introducir la información solicitada'])
    assert fin['resultado']['puntaje'] == 55
    assert fin['resultado']['es_vulnerable'] is True
    intento_id = fin['intento']['id']

    # Idempotente
    otra = client.post(f'/api/attempts/{intento_id}/finish', headers=auth(u['token'])).json()
    assert otra['resultado']['puntaje'] == 55

    # RN-13: no puede iniciar otro escenario sin confirmar la retroalimentación
    r = client.post('/api/attempts', json={'escenario_id': e['id']}, headers=auth(u['token']))
    assert r.status_code == 409
    assert r.json()['error'] == {
        'code': 'RETROALIMENTACION_PENDIENTE',
        'message': 'Antes de iniciar otro escenario, revisa y confirma la retroalimentación del anterior.',
        'details': {'intento_id': intento_id},
    }
    r = client.post(f'/api/attempts/{intento_id}/confirm-feedback', headers=auth(u['token']))
    assert r.json()['intento']['resultado_revisado'] is True

    # Métricas e historial
    m = client.get(f"/api/users/{u['usuario']['id']}/metrics", headers=auth(u['token'])).json()
    assert m['resumen']['total_simulaciones'] == 1
    assert m['resumen']['nivel_vulnerabilidad'] == 'alto'
    phishing = next(t for t in m['por_tipo'] if t['tipo'] == 'phishing')
    assert (phishing['total_intentos'], phishing['errores']) == (1, 2)
    assert len(m['por_subcategoria']) == 15
    sub = next(s for s in m['por_subcategoria'] if s['subcategoria'] == 'alertas_seguridad_ti')
    assert (sub['total_intentos'], sub['nivel_vulnerabilidad']) == (1, 'alto')
    h = client.get(f"/api/users/{u['usuario']['id']}/history", headers=auth(u['token'])).json()
    assert [x['intento_id'] for x in h['datos']] == [intento_id]

    # RN-10: el escenario completado ya no se recomienda
    rec = client.get('/api/scenarios/recommended', headers=auth(u['token'])).json()['recomendacion']
    assert rec is None or rec['escenario']['id'] != e['id']

    # Otro usuario no ve el intento
    otro = registrar()
    assert client.get(f'/api/attempts/{intento_id}', headers=auth(otro['token'])).status_code == 404


def test_opcion_de_otro_paso(client, registrar):
    u = registrar()
    e = _ph001(client, u['token'])
    r = client.post('/api/attempts', json={'escenario_id': e['id']}, headers=auth(u['token']))
    intento_id = r.json()['intento']['id']
    r = client.post(f'/api/attempts/{intento_id}/responses', json={'opcion_id': 999999}, headers=auth(u['token']))
    assert r.status_code == 400
    assert client.post(f'/api/attempts/{intento_id}/finish', headers=auth(u['token'])).status_code == 409
    assert client.post(f'/api/attempts/{intento_id}/abandon', headers=auth(u['token'])).status_code == 204


def test_un_solo_intento_en_curso(client, registrar):
    # RN-29: iniciar otro intento abandona el que estaba en curso.
    u = registrar()
    e = _ph001(client, u['token'])
    primero = client.post('/api/attempts', json={'escenario_id': e['id']}, headers=auth(u['token'])).json()['intento']
    segundo = client.post('/api/attempts', json={'escenario_id': e['id']}, headers=auth(u['token'])).json()['intento']
    r = client.get(f"/api/attempts/{primero['id']}", headers=auth(u['token'])).json()
    assert r['intento']['estado'] == 'abandonado'
    assert (segundo['estado'], segundo['numero_intento']) == ('en_curso', 2)


# --- Recuperación de contraseña -----------------------------------------------

def test_recuperacion(client, registrar):
    from app.modules import mail

    u = registrar()
    correo = u['usuario']['correo']
    r = client.post('/api/auth/forgot-password', json={'correo': correo})
    assert r.status_code == 200
    # La respuesta es la misma para un correo inexistente.
    assert client.post('/api/auth/forgot-password', json={'correo': 'nadie@test.local'}).json() == r.json()

    mensaje = next(m for m in reversed(mail.enviados) if m['para'] == correo)
    codigo = re.search(r'\b(\d{6})\b', mensaje['texto']).group(1)
    assert 'http' not in mensaje['html']

    incorrecto = '000000' if codigo != '000000' else '111111'
    r = client.post('/api/auth/reset-password', json={
        'correo': correo, 'codigo': incorrecto, 'password': 'NuevaClave123', 'confirmar_password': 'NuevaClave123'})
    assert r.status_code == 400
    assert 'Te quedan 4 intento(s)' in r.json()['error']['message']

    r = client.post('/api/auth/reset-password', json={
        'correo': correo, 'codigo': codigo, 'password': 'NuevaClave123', 'confirmar_password': 'NuevaClave123'})
    assert r.status_code == 200, r.text
    assert client.get('/api/auth/me', headers=auth(u['token'])).status_code == 401
    assert client.post('/api/auth/login', json={'correo': correo, 'password': 'NuevaClave123'}).status_code == 200
