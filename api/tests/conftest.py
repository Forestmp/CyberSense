"""
Configuración de pruebas.

Las pruebas del motor no necesitan BD. Las de integración necesitan un
PostgreSQL desechable (nunca Supabase) en TEST_DATABASE_URL, por ejemplo:
  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tt_test
Sin esa variable se omiten. El esquema se borra y se recrea al iniciar.
"""
import os

import pytest

TEST_DB = os.environ.get('TEST_DATABASE_URL')

os.environ.update({
    'ENV': 'test',
    'DATABASE_URL': TEST_DB or 'postgresql://sin-bd/omitida',
    'DB_SSL': 'false',
    'JWT_SECRET': 'secreto-solo-para-pruebas-automatizadas-0123456789',
    'BCRYPT_ROUNDS': '4',
    'MAIL_PROVIDER': 'console',
    'ADMIN_NAME': 'Admin Pruebas',
    'ADMIN_EMAIL': 'admin@test.local',
    'ADMIN_PASSWORD': 'AdminPrueba123',
})


@pytest.fixture(scope='session')
def client():
    if not TEST_DB:
        pytest.skip('Define TEST_DATABASE_URL para correr las pruebas de integración')
    from fastapi.testclient import TestClient

    from app.main import app
    from scripts.migrate import migrate
    from scripts.seed import seed

    with TestClient(app) as c:  # abre el pool (lifespan)
        migrate(reset_first=True)
        seed()
        yield c


_contador = 0


@pytest.fixture
def registrar(client):
    """Registra un usuario nuevo con correo único y devuelve {token, usuario, password}."""
    def _registrar(**datos):
        global _contador
        _contador += 1
        password = datos.get('password', 'Segura123')
        res = client.post('/api/auth/register', json={
            'nombre': datos.get('nombre', f'Usuario {_contador}'),
            'correo': datos.get('correo', f'usuario{os.getpid()}_{_contador}@test.local'),
            'password': password,
            'confirmar_password': password,
            'acepta_aviso_privacidad': True,
            'mayor_de_edad': True,
        })
        assert res.status_code == 201, res.text
        return {**res.json(), 'password': password}
    return _registrar


@pytest.fixture
def admin(client):
    res = client.post('/api/auth/login', json={'correo': 'admin@test.local', 'password': 'AdminPrueba123'})
    assert res.status_code == 200, res.text
    return res.json()


def auth(token: str) -> dict:
    return {'Authorization': f'Bearer {token}'}
