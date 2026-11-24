"""Pruebas de cuentas: aviso de privacidad, límite de intentos, anonimización y protección del administrador."""
from tests.conftest import auth


def _crear_por_admin(client, admin, correo):
    r = client.post('/api/users', headers=auth(admin['token']),
                    json={'nombre': 'Creada por admin', 'correo': correo, 'password': 'Segura123'})
    assert r.status_code == 201, r.text
    return r.json()['usuario']


# --- RN-23: aviso de privacidad y mayoría de edad -------------------------------

def test_registro_exige_aviso_y_mayoria_de_edad(client):
    r = client.post('/api/auth/register', json={
        'nombre': 'Ana', 'correo': 'sin-aviso@test.local', 'password': 'Segura123', 'confirmar_password': 'Segura123',
        'acepta_aviso_privacidad': False, 'mayor_de_edad': False})
    assert r.status_code == 400
    assert {(d['campo'], d['mensaje']) for d in r.json()['error']['details']} == {
        ('body.acepta_aviso_privacidad', 'Debes aceptar el aviso de privacidad'),
        ('body.mayor_de_edad', 'Debes declarar que eres mayor de 18 años'),
    }


def test_registro_guarda_la_aceptacion(registrar):
    assert registrar()['usuario']['fecha_aceptacion_aviso'] is not None


def test_cuenta_creada_por_admin_acepta_en_su_primer_inicio(client, admin):
    creada = _crear_por_admin(client, admin, 'primer-inicio@test.local')
    assert creada['fecha_aceptacion_aviso'] is None

    token = client.post('/api/auth/login', json={'correo': 'primer-inicio@test.local', 'password': 'Segura123'}).json()['token']
    # Puede consultar su cuenta, pero nada más hasta aceptar el aviso.
    assert client.get('/api/auth/me', headers=auth(token)).json()['usuario']['fecha_aceptacion_aviso'] is None
    r = client.get('/api/scenarios', headers=auth(token))
    assert (r.status_code, r.json()['error']['code']) == (403, 'AVISO_PENDIENTE')

    r = client.post('/api/auth/accept-privacy', headers=auth(token),
                    json={'acepta_aviso_privacidad': True, 'mayor_de_edad': False})
    assert r.status_code == 400

    r = client.post('/api/auth/accept-privacy', headers=auth(token),
                    json={'acepta_aviso_privacidad': True, 'mayor_de_edad': True})
    assert r.status_code == 200
    assert r.json()['usuario']['fecha_aceptacion_aviso'] is not None
    assert client.get('/api/scenarios', headers=auth(token)).status_code == 200


# --- RN-28: bloqueo por intentos fallidos ---------------------------------------

def test_bloqueo_tras_cinco_intentos_fallidos(client, registrar):
    u = registrar()
    correo = u['usuario']['correo']
    for _ in range(5):
        assert client.post('/api/auth/login', json={'correo': correo, 'password': 'Incorrecta1'}).status_code == 401
    # Al sexto intento se rechaza aunque la contraseña sea correcta.
    r = client.post('/api/auth/login', json={'correo': correo, 'password': u['password']})
    assert (r.status_code, r.json()['error']['code']) == (429, 'CUENTA_BLOQUEADA_TEMPORALMENTE')


def test_inicio_correcto_reinicia_el_conteo(client, registrar):
    u = registrar()
    correo = u['usuario']['correo']
    for _ in range(4):
        client.post('/api/auth/login', json={'correo': correo, 'password': 'Incorrecta1'})
    assert client.post('/api/auth/login', json={'correo': correo, 'password': u['password']}).status_code == 200
    for _ in range(4):
        client.post('/api/auth/login', json={'correo': correo, 'password': 'Incorrecta1'})
    assert client.post('/api/auth/login', json={'correo': correo, 'password': u['password']}).status_code == 200


# --- RN-24: anonimización -------------------------------------------------------

def test_admin_anonimiza_una_cuenta(client, admin, registrar):
    u = registrar()
    id_, correo = u['usuario']['id'], u['usuario']['correo']

    r = client.post(f'/api/users/{id_}/anonymize', headers=auth(admin['token']))
    assert r.status_code == 200, r.text
    anon = r.json()['usuario']
    assert (anon['nombre'], anon['correo'], anon['estado']) == (None, None, 'eliminada')
    assert anon['fecha_anonimizacion'] is not None

    # Sin acceso: el token anterior deja de valer y el correo ya no existe.
    assert client.get('/api/auth/me', headers=auth(u['token'])).status_code == 401
    assert client.post('/api/auth/login', json={'correo': correo, 'password': u['password']}).status_code == 401

    # Irreversible
    assert client.post(f'/api/users/{id_}/anonymize', headers=auth(admin['token'])).status_code == 409
    r = client.put(f'/api/users/{id_}', headers=auth(admin['token']), json={'estado': 'activa'})
    assert r.status_code == 409

    # El correo queda libre para un registro nuevo.
    nuevo = client.post('/api/auth/register', json={
        'nombre': 'Nueva', 'correo': correo, 'password': 'Segura123', 'confirmar_password': 'Segura123',
        'acepta_aviso_privacidad': True, 'mayor_de_edad': True})
    assert nuevo.status_code == 201


def test_usuario_no_puede_anonimizar(client, registrar):
    a, b = registrar(), registrar()
    assert client.post(f"/api/users/{b['usuario']['id']}/anonymize", headers=auth(a['token'])).status_code == 403


# --- RN-30: el administrador no puede quitarse acceso a sí mismo --------------

def test_admin_se_protege_a_si_mismo(client, admin):
    id_ = admin['usuario']['id']
    token = auth(admin['token'])
    assert client.delete(f'/api/users/{id_}', headers=token).status_code == 400
    assert client.post(f'/api/users/{id_}/anonymize', headers=token).status_code == 400
    assert client.put(f'/api/users/{id_}', headers=token, json={'estado': 'inactiva'}).status_code == 400
    assert client.put(f'/api/users/{id_}', headers=token, json={'rol': 'usuario'}).status_code == 400
    assert client.get('/api/auth/me', headers=token).json()['usuario']['rol'] == 'administrador'


# --- RN-32: estados de cuenta ---------------------------------------------------

def test_cuenta_inactiva_y_restaurada(client, admin):
    creada = _crear_por_admin(client, admin, 'estados@test.local')
    id_ = creada['id']
    r = client.put(f'/api/users/{id_}', headers=auth(admin['token']), json={'estado': 'inactiva'})
    assert r.json()['usuario']['estado'] == 'inactiva'
    assert client.post('/api/auth/login', json={'correo': 'estados@test.local', 'password': 'Segura123'}).status_code == 403

    assert client.delete(f'/api/users/{id_}', headers=auth(admin['token'])).status_code == 204
    r = client.put(f'/api/users/{id_}', headers=auth(admin['token']), json={'estado': 'activa'})
    assert (r.json()['usuario']['estado'], r.json()['usuario']['fecha_eliminacion']) == ('activa', None)
    assert client.post('/api/auth/login', json={'correo': 'estados@test.local', 'password': 'Segura123'}).status_code == 200
