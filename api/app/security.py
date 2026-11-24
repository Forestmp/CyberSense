"""Contraseñas (bcrypt), tokens JWT y dependencias de autenticación."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, Request

from app.config import settings
from app.db import query_one
from app.errors import AppError


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(settings.BCRYPT_ROUNDS)).decode()


def verificar_password(password: str, hash_: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hash_.encode())
    except ValueError:
        return False


def firmar_token(usuario: dict, ver: int = 0) -> str:
    """`ver` es la versión de sesión del usuario; si cambia, el token deja de ser válido."""
    ahora = datetime.now(timezone.utc)
    payload = {
        'sub': str(usuario['id']), 'rol': usuario['rol'], 'ver': ver,
        'iat': ahora, 'exp': ahora + timedelta(hours=settings.JWT_EXPIRES_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def usuario_sin_aviso(request: Request) -> dict:
    """
    Exige un token Bearer válido. Se consulta al usuario en cada petición para
    que un cambio de rol o una desactivación surtan efecto de inmediato.
    No exige el aviso de privacidad: solo lo usan las rutas que permiten aceptarlo.
    """
    esquema, _, token = request.headers.get('authorization', '').partition(' ')
    if esquema != 'Bearer' or not token:
        raise AppError.unauthorized('Falta el token de autenticación')
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
        usuario_id = int(payload['sub'])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise AppError.unauthorized('Token inválido o expirado')

    usuario = query_one(
        """SELECT id, nombre, correo, rol, estado, token_version, fecha_aceptacion_aviso
             FROM usuarios WHERE id = %s""", (usuario_id,)
    )
    if not usuario:
        raise AppError.unauthorized('Token inválido o expirado')
    # Tokens anteriores a un cambio de contraseña ya no son válidos.
    if payload.get('ver', 0) != usuario.pop('token_version'):
        raise AppError.unauthorized('Tu sesión ya no es válida. Inicia sesión de nuevo.')
    if usuario['estado'] != 'activa':
        raise AppError.forbidden('La cuenta no está activa')
    return usuario


def usuario_actual(usuario: Annotated[dict, Depends(usuario_sin_aviso)]) -> dict:
    """Además del token, exige que el usuario haya aceptado el aviso de privacidad (RN-23)."""
    if usuario['fecha_aceptacion_aviso'] is None:
        raise AppError(403, 'Debes aceptar el aviso de privacidad para continuar', 'AVISO_PENDIENTE')
    return usuario


def solo_admin(usuario: Annotated[dict, Depends(usuario_actual)]) -> dict:
    if usuario['rol'] != 'administrador':
        raise AppError.forbidden()
    return usuario


def exigir_propio_o_admin(usuario: dict, id_: int):
    """Permite el acceso si el id corresponde al usuario autenticado o si es admin."""
    if usuario['rol'] != 'administrador' and usuario['id'] != id_:
        raise AppError.forbidden()


UsuarioSinAviso = Annotated[dict, Depends(usuario_sin_aviso)]
Usuario = Annotated[dict, Depends(usuario_actual)]
Admin = Annotated[dict, Depends(solo_admin)]
