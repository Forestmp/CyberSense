"""Registro, inicio de sesión, aviso de privacidad y recuperación de contraseña."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules import recovery
from app.modules import users_repo as users
from app.errors import AppError
from app.rate_limit import BloqueoPorCorreo, Limitador
from app.schemas import Correo, Nombre, Password
from app.security import UsuarioSinAviso, firmar_token, hash_password, verificar_password

router = APIRouter(prefix='/api/auth', tags=['auth'])

# RN-28: registro e inicio de sesión comparten 100 peticiones por IP cada 15
# minutos, la recuperación de contraseña admite 20 por IP, y un correo se
# bloquea 15 minutos tras 5 inicios de sesión fallidos.
limitador = Limitador(100, 15 * 60, 'Demasiados intentos. Intenta de nuevo más tarde.')
limitador_recuperacion = Limitador(20, 15 * 60, 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.')
bloqueo_correo = BloqueoPorCorreo(
    5, 15 * 60, 'Demasiados intentos fallidos con este correo. Intenta de nuevo en 15 minutos.')

# Hash de relleno: si el correo no existe se compara igualmente para que el
# tiempo de respuesta no revele qué correos están registrados.
_HASH_RELLENO = hash_password('relleno-no-utilizable')


class _ConConfirmacion(BaseModel):
    @model_validator(mode='after')
    def coinciden(self):
        if self.password != self.confirmar_password:
            raise AppError.bad_request('Datos de entrada inválidos', [
                {'campo': 'body.confirmar_password', 'mensaje': 'Las contraseñas no coinciden'},
            ])
        return self


class AvisoIn(BaseModel):
    """RN-23: el usuario declara ser mayor de 18 años y acepta el aviso de privacidad."""
    acepta_aviso_privacidad: bool
    mayor_de_edad: bool

    @field_validator('acepta_aviso_privacidad')
    @classmethod
    def _acepta(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError('Debes aceptar el aviso de privacidad')
        return v

    @field_validator('mayor_de_edad')
    @classmethod
    def _mayor(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError('Debes declarar que eres mayor de 18 años')
        return v


class RegistroIn(_ConConfirmacion, AvisoIn):
    nombre: Nombre
    correo: Correo
    password: Password
    confirmar_password: str


class LoginIn(BaseModel):
    correo: Correo
    password: str = Field(min_length=1)


class OlvideIn(BaseModel):
    correo: Correo


class RestablecerIn(_ConConfirmacion):
    correo: Correo
    codigo: str
    password: Password
    confirmar_password: str

    @field_validator('codigo')
    @classmethod
    def _seis_digitos(cls, v: str) -> str:
        v = v.strip()
        if not (len(v) == 6 and v.isascii() and v.isdigit()):
            raise ValueError('El código tiene 6 dígitos')
        return v


@router.post('/register', status_code=201, dependencies=[Depends(limitador)])
def registrar(datos: RegistroIn):
    if users.find_by_email_with_hash(datos.correo):
        raise AppError.conflict('El correo ya está registrado')
    usuario = users.crear(datos.nombre, datos.correo, hash_password(datos.password), acepto_aviso=True)
    return {'token': firmar_token(usuario), 'usuario': usuario}


@router.post('/login', dependencies=[Depends(limitador)])
def iniciar_sesion(datos: LoginIn):
    bloqueo_correo.verificar(datos.correo)
    encontrado = users.find_by_email_with_hash(datos.correo)
    valida = verificar_password(datos.password, encontrado['password_hash'] if encontrado else _HASH_RELLENO)
    if not encontrado or not valida:
        bloqueo_correo.registrar_fallo(datos.correo)
        raise AppError.unauthorized('Correo o contraseña incorrectos')
    bloqueo_correo.reiniciar(datos.correo)
    if encontrado['estado'] != 'activa':
        raise AppError.forbidden('La cuenta no está activa')

    version = encontrado.pop('token_version')
    encontrado.pop('password_hash')
    return {'token': firmar_token(encontrado, version), 'usuario': encontrado}


@router.post('/accept-privacy')
def aceptar_aviso(usuario: UsuarioSinAviso, _: AvisoIn):
    """
    Cuentas creadas por un administrador: su titular acepta el aviso de
    privacidad en su primer inicio de sesión (RN-23). Idempotente.
    """
    return {'usuario': users.aceptar_aviso(usuario['id'])}


@router.post('/forgot-password', dependencies=[Depends(limitador_recuperacion)])
def olvide_password(datos: OlvideIn):
    return recovery.solicitar(datos.correo)


@router.post('/reset-password', dependencies=[Depends(limitador_recuperacion)])
def restablecer_password(datos: RestablecerIn):
    return recovery.restablecer(datos.correo, datos.codigo, datos.password)


@router.get('/me')
def yo(usuario: UsuarioSinAviso):
    """Disponible aunque falte aceptar el aviso, para que la app sepa que debe pedirlo."""
    return {'usuario': users.find_by_id(usuario['id'])}
