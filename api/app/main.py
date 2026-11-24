"""API REST de CyberSense (FastAPI). Ejecutar con: uvicorn app.main:app"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import pool, query
from app.errors import registrar_manejadores
from app.modules import attempts, auth, diagnostic, scenarios, users

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title='CyberSense API',
    description='API del sistema de concientización ante ataques de ingeniería social (TT ESCOM-IPN)',
    lifespan=lifespan,
    # La documentación interactiva solo se publica fuera de producción.
    docs_url=None if settings.ENV == 'production' else '/api/docs',
    redoc_url=None,
    openapi_url=None if settings.ENV == 'production' else '/api/openapi.json',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def cabeceras_seguridad(request: Request, call_next):
    """Cabeceras básicas de seguridad y límite de tamaño del cuerpo (200 kB)."""
    largo = request.headers.get('content-length')
    if largo and largo.isdigit() and int(largo) > 200 * 1024:
        return JSONResponse(status_code=413, content={
            'error': {'code': 'PAYLOAD_TOO_LARGE', 'message': 'La petición es demasiado grande'},
        })
    respuesta = await call_next(request)
    respuesta.headers['X-Content-Type-Options'] = 'nosniff'
    respuesta.headers['X-Frame-Options'] = 'DENY'
    respuesta.headers['Referrer-Policy'] = 'no-referrer'
    if settings.ENV == 'production':
        respuesta.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return respuesta


registrar_manejadores(app)


@app.get('/api/health')
def health():
    try:
        query('SELECT 1')
        return {'status': 'ok', 'database': 'ok'}
    except Exception:  # noqa: BLE001
        return JSONResponse(status_code=503, content={'status': 'degraded', 'database': 'unavailable'})


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(scenarios.catalogos_router)
app.include_router(scenarios.router)
app.include_router(attempts.router)
app.include_router(diagnostic.router)
