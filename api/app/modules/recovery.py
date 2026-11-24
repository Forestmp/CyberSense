"""
Recuperación de contraseña con un código de 6 dígitos enviado por correo.

- La respuesta de "solicitar" es idéntica exista o no el correo, para no
  revelar qué cuentas están registradas.
- Se guarda un HMAC del código (nunca el código), vence en 15 minutos,
  admite 5 intentos y es de un solo uso.
- Al restablecer se incrementa la versión de sesión: se cierran las
  sesiones abiertas en otros dispositivos.
"""
import hashlib
import hmac as hmac_
import logging
import secrets

from app.config import settings
from app.db import query_one, transaction
from app.errors import AppError
from app.modules import mail
from app.modules import users_repo as users
from app.security import firmar_token, hash_password

log = logging.getLogger('api.recovery')

MINUTOS_VIGENCIA = 15
MAX_INTENTOS = 5
ESPERA_REENVIO_SEG = 60

MENSAJE_SOLICITUD = 'Si el correo está registrado, te enviamos un código de 6 dígitos. Revisa también tu carpeta de spam.'


def _hmac(codigo: str) -> str:
    return hmac_.new(settings.JWT_SECRET.encode(), codigo.encode(), hashlib.sha256).hexdigest()


def solicitar(correo: str) -> dict:
    usuario = query_one(
        "SELECT id, nombre, correo FROM usuarios WHERE lower(correo) = lower(%s) AND estado = 'activa'", (correo,)
    )
    if not usuario:
        return {'mensaje': MENSAJE_SOLICITUD}

    # Evita reenvíos seguidos (y el abuso del servicio de correo).
    reciente = query_one(
        """SELECT 1 FROM recuperaciones_password
            WHERE usuario_id = %s AND usado_en IS NULL AND creado_en > now() - make_interval(secs => %s)""",
        (usuario['id'], ESPERA_REENVIO_SEG),
    )
    if reciente:
        return {'mensaje': MENSAJE_SOLICITUD}

    codigo = f'{secrets.randbelow(1_000_000):06d}'
    with transaction() as conn:
        # Solo vale el código más reciente.
        conn.execute(
            'UPDATE recuperaciones_password SET usado_en = now() WHERE usuario_id = %s AND usado_en IS NULL',
            (usuario['id'],),
        )
        conn.execute(
            """INSERT INTO recuperaciones_password (usuario_id, codigo_hash, expira_en)
               VALUES (%s, %s, now() + make_interval(mins => %s::int))""",
            (usuario['id'], _hmac(codigo), MINUTOS_VIGENCIA),
        )

    try:
        mail.enviar(para=usuario['correo'], nombre=usuario['nombre'],
                    **mail.codigo_recuperacion(usuario['nombre'], codigo, MINUTOS_VIGENCIA))
    except Exception as err:  # noqa: BLE001
        # No se revela el fallo al cliente (sería revelar que la cuenta existe); queda en los logs.
        log.error('No se pudo enviar el código de recuperación al usuario %s: %s', usuario['id'], err)
    return {'mensaje': MENSAJE_SOLICITUD}


def restablecer(correo: str, codigo: str, password: str) -> dict:
    invalido = AppError.bad_request('El código es incorrecto o ya venció. Solicita uno nuevo.')

    with transaction() as conn:
        usuario = conn.execute(
            "SELECT id, nombre, correo, rol, estado FROM usuarios WHERE lower(correo) = lower(%s) AND estado = 'activa'",
            (correo,),
        ).fetchone()
        if not usuario:
            raise invalido

        rec = conn.execute(
            """SELECT id, codigo_hash, intentos FROM recuperaciones_password
                WHERE usuario_id = %s AND usado_en IS NULL AND expira_en > now()
                ORDER BY creado_en DESC LIMIT 1 FOR UPDATE""",
            (usuario['id'],),
        ).fetchone()
        if not rec or rec['intentos'] >= MAX_INTENTOS:
            raise invalido

        error = None
        if not hmac_.compare_digest(_hmac(codigo), rec['codigo_hash']):
            intentos = rec['intentos'] + 1
            agotado = intentos >= MAX_INTENTOS
            conn.execute(
                """UPDATE recuperaciones_password
                      SET intentos = %s, usado_en = CASE WHEN %s THEN now() END WHERE id = %s""",
                (intentos, agotado, rec['id']),
            )
            # No se lanza aquí para que el intento quede guardado; lanzar haría ROLLBACK.
            error = ('Demasiados intentos con este código. Solicita uno nuevo.' if agotado
                     else f'El código es incorrecto. Te quedan {MAX_INTENTOS - intentos} intento(s).')
        else:
            conn.execute(
                'UPDATE recuperaciones_password SET usado_en = now() WHERE usuario_id = %s AND usado_en IS NULL',
                (usuario['id'],),
            )
            version = conn.execute(
                """UPDATE usuarios SET password_hash = %s, token_version = token_version + 1
                    WHERE id = %s RETURNING token_version""",
                (hash_password(password), usuario['id']),
            ).fetchone()['token_version']

    # El intento fallido ya quedó guardado (la transacción terminó con COMMIT).
    if error:
        raise AppError.bad_request(error)
    # Se inicia sesión directamente con la contraseña nueva.
    return {'token': firmar_token(usuario, version), 'usuario': users.find_by_id(usuario['id'])}


