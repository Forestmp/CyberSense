# CyberSense · API (FastAPI)

API REST del sistema de concientización ante ataques de ingeniería social. Usa Python 3.14, FastAPI y PostgreSQL. En producción la base de datos está en Supabase, que se usa solo como PostgreSQL administrado.

## Puesta en marcha

```powershell
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env          # y completa DATABASE_URL, JWT_SECRET, ADMIN_*

python -m scripts.migrate       # crea/actualiza el esquema
python -m scripts.seed          # catálogos, administrador y escenarios de ejemplo
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- La documentación interactiva queda en <http://localhost:8000/api/docs>. Fuera de producción se publica; en producción está desactivada.
- `python -m scripts.migrate --reset` borra las tablas y vuelve a crear el esquema. Úsalo solo en desarrollo.
- `python -m scripts.seed --actualizar-escenarios` sobrescribe los escenarios con su JSON.

## Pruebas

```powershell
pytest                                   # motor de evaluación (sin BD)
$env:TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tt_test"
pytest                                   # además, integración contra un PostgreSQL desechable
```

Las pruebas de integración borran y recrean el esquema de `TEST_DATABASE_URL`. Nunca la apuntes a Supabase.

## Estructura

| Ruta | Contenido |
|---|---|
| `app/main.py` | Aplicación, CORS, cabeceras de seguridad y rutas |
| `app/config.py` | Variables de entorno (`.env`) |
| `app/db.py` | Pool de conexiones (psycopg 3) y transacciones |
| `app/errors.py` | Formato de errores `{error: {code, message, details}}` |
| `app/security.py` | bcrypt, JWT y dependencias de autenticación |
| `app/modules/auth.py`, `recovery.py` | Registro, inicio de sesión y recuperación con código por correo (Brevo) |
| `app/modules/users.py` | Perfil, administración de usuarios, historial y métricas |
| `app/modules/scenarios*.py` | Escenarios: esquema, validación del grafo, repositorio y rutas |
| `app/modules/attempts*.py` | Ejecución de simulaciones |
| `app/modules/engine.py` | Motor de evaluación por reglas (función pura) |
| `app/modules/selector.py` | Selección del siguiente escenario (punto de extensión adaptativo) |
| `db/migrations`, `db/seeds` | Esquema SQL y datos iniciales |

## Despliegue

Usa `render.yaml`, un Blueprint de Render con `rootDir: api`. Antes del arranque aplica las migraciones pendientes.
