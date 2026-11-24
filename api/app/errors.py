"""Errores de aplicación y su traducción a JSON: {error: {code, message, details}}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg import errors as pg
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings

log = logging.getLogger('api')


class AppError(Exception):
    """Error con código HTTP; el manejador lo convierte en la respuesta JSON."""

    def __init__(self, status: int, message: str, code: str | None = None, details=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code
        self.details = details

    @staticmethod
    def bad_request(msg: str, details=None):
        return AppError(400, msg, 'BAD_REQUEST', details)

    @staticmethod
    def unauthorized(msg: str = 'No autenticado'):
        return AppError(401, msg, 'UNAUTHORIZED')

    @staticmethod
    def forbidden(msg: str = 'No tienes permiso para realizar esta acción'):
        return AppError(403, msg, 'FORBIDDEN')

    @staticmethod
    def not_found(msg: str = 'Recurso no encontrado'):
        return AppError(404, msg, 'NOT_FOUND')

    @staticmethod
    def conflict(msg: str, details=None):
        return AppError(409, msg, 'CONFLICT', details)


def _respuesta(status: int, code: str, message: str, details=None) -> JSONResponse:
    error = {'code': code, 'message': message}
    if details is not None:
        error['details'] = details
    return JSONResponse(status_code=status, content={'error': error})


# Mensajes en español para los errores de validación más comunes de Pydantic.
_MENSAJES = {
    'missing': 'Campo obligatorio',
    'int_parsing': 'Debe ser un número entero',
    'int_type': 'Debe ser un número entero',
    'int_from_float': 'Debe ser un número entero',
    'string_type': 'Debe ser texto',
    'bool_type': 'Debe ser verdadero o falso',
    'bool_parsing': 'Debe ser verdadero o falso',
    'list_type': 'Debe ser una lista',
    'dict_type': 'Debe ser un objeto',
    'model_type': 'Debe ser un objeto',
    'literal_error': 'Valor no válido',
    'enum': 'Valor no válido',
    'extra_forbidden': 'Campo no permitido',
    'string_pattern_mismatch': 'Formato no válido',
    'union_tag_invalid': 'Tipo de regla no válido',
    'union_tag_not_found': 'Tipo de regla no válido',
    'greater_than': 'Debe ser mayor que {gt}',
    'greater_than_equal': 'Debe ser mayor o igual a {ge}',
    'less_than': 'Debe ser menor que {lt}',
    'less_than_equal': 'Debe ser menor o igual a {le}',
    'string_too_short': 'Debe tener al menos {min_length} caracteres',
    'string_too_long': 'Máximo {max_length} caracteres',
    'too_short': 'Debe tener al menos {min_length} elementos',
    'too_long': 'Máximo {max_length} elementos',
}

# FastAPI llama "path" a lo que Express llamaba "params"; se conserva el nombre anterior.
_PARTES = {'path': 'params', 'query': 'query', 'body': 'body'}
_VARIANTES = {'OPCION_SELECCIONADA', 'TIPO_ACCION_PRESENTE', 'CONTEO_TIPO_ACCION', 'SECUENCIA'}


def _mensaje(e: dict) -> str:
    if e['type'] == 'value_error':
        return str(e.get('ctx', {}).get('error', e['msg']))
    plantilla = _MENSAJES.get(e['type'])
    if not plantilla:
        return e['msg']
    try:
        return plantilla.format(**e.get('ctx', {}))
    except (KeyError, IndexError):
        return e['msg']


def detalles_validacion(errores: list[dict]) -> list[dict]:
    detalles = []
    for e in errores:
        loc = list(e['loc'])
        if loc and loc[0] in _PARTES:
            loc[0] = _PARTES[loc[0]]
        # Las uniones discriminadas agregan el nombre de la variante a la ruta.
        loc = [p for p in loc if p not in _VARIANTES]
        detalles.append({'campo': '.'.join(str(p) for p in loc), 'mensaje': _mensaje(e)})
    return detalles


def registrar_manejadores(app: FastAPI):
    @app.exception_handler(AppError)
    async def _app_error(request: Request, err: AppError):
        return _respuesta(err.status, err.code or 'ERROR', err.message, err.details)

    @app.exception_handler(RequestValidationError)
    async def _validacion(request: Request, err: RequestValidationError):
        errores = err.errors()
        if any(e['type'] == 'json_invalid' for e in errores):
            return _respuesta(400, 'BAD_REQUEST', 'El cuerpo de la petición no es JSON válido')
        return _respuesta(400, 'BAD_REQUEST', 'Datos de entrada inválidos', detalles_validacion(errores))

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, err: StarletteHTTPException):
        if err.status_code in (404, 405):
            return _respuesta(404, 'NOT_FOUND', f'Ruta no encontrada: {request.method} {request.url.path}')
        return _respuesta(err.status_code, 'ERROR', str(err.detail))

    # Violaciones de restricciones de PostgreSQL que no se validaron antes.
    @app.exception_handler(pg.UniqueViolation)
    async def _unico(request: Request, err: pg.UniqueViolation):
        return _respuesta(409, 'CONFLICT', 'El registro ya existe', err.diag.message_detail)

    @app.exception_handler(pg.ForeignKeyViolation)
    @app.exception_handler(pg.CheckViolation)
    @app.exception_handler(pg.InvalidTextRepresentation)
    async def _datos(request: Request, err: pg.Error):
        return _respuesta(400, 'BAD_REQUEST', 'Datos inválidos', err.diag.message_detail)

    @app.exception_handler(Exception)
    async def _interno(request: Request, err: Exception):
        log.exception('Error no controlado')
        return _respuesta(500, 'INTERNAL', 'Error interno del servidor',
                          str(err) if settings.ENV == 'development' else None)
