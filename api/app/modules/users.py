"""Usuarios: administración, perfil, historial y métricas."""
import secrets
from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.db import pool, transaction
from app.errors import AppError
from app.modules import metrics_repo as metrics
from app.modules import predictions
from app.modules import users_repo as users
from app.schemas import Correo, Nombre, Password
from app.security import Admin, Usuario, exigir_propio_o_admin, firmar_token, hash_password, verificar_password

router = APIRouter(prefix='/api/users', tags=['users'])

Rol = Literal['usuario', 'administrador']
# 'eliminada' solo se asigna con DELETE.
EstadoEditable = Literal['activa', 'inactiva']
IdPath = Annotated[int, Path(gt=0)]


class ListaQuery(BaseModel):
    pagina: int = Field(1, ge=1)
    limite: int = Field(20, ge=1, le=100)
    buscar: str | None = Field(None, max_length=100)
    rol: Rol | None = None
    estado: Literal['activa', 'inactiva', 'eliminada'] | None = None


class CrearIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    nombre: Nombre
    correo: Correo
    password: Password
    rol: Rol = 'usuario'
    estado: EstadoEditable = 'activa'


class ActualizarIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    nombre: Nombre | None = None
    correo: Correo | None = None
    password_actual: str | None = None
    password_nueva: Password | None = None
    # Solo administradores:
    rol: Rol | None = None
    estado: EstadoEditable | None = None

    @model_validator(mode='after')
    def _no_vacio(self):
        if not self.model_fields_set:
            raise ValueError('No se envió ningún campo para actualizar')
        return self


class HistorialQuery(BaseModel):
    pagina: int = Field(1, ge=1)
    limite: int = Field(20, ge=1, le=100)
    tipo: str | None = Field(None, pattern=r'^[a-z_]{2,40}$')


def _asegurar_correo_libre(correo: str, id_actual: int | None = None):
    otro = users.find_by_email_with_hash(correo)
    if otro and otro['id'] != id_actual:
        raise AppError.conflict('El correo ya está registrado')


def _existente(id_: int) -> dict:
    usuario = users.find_by_id(id_)
    if not usuario:
        raise AppError.not_found('Usuario no encontrado')
    return usuario


# --- Administración (solo admin) -------------------------------------------

@router.get('')
def listar(_: Admin, q: Annotated[ListaQuery, Query()]):
    buscar = q.buscar.strip() if q.buscar else None
    return users.listar(q.pagina, q.limite, buscar, q.rol, q.estado)


@router.post('', status_code=201)
def crear(_: Admin, datos: CrearIn):
    _asegurar_correo_libre(datos.correo)
    usuario = users.crear(datos.nombre, datos.correo, hash_password(datos.password), datos.rol, datos.estado)
    return {'usuario': usuario}


@router.delete('/{id}', status_code=204)
def eliminar(yo: Admin, id: IdPath):
    if id == yo['id']:
        raise AppError.bad_request('No puedes eliminar tu propia cuenta')
    usuario = users.find_by_id(id)
    if not usuario or usuario['estado'] == 'eliminada':
        raise AppError.not_found('Usuario no encontrado')
    users.eliminar_logico(id)
    return Response(status_code=204)


@router.post('/{id}/anonymize')
def anonimizar(yo: Admin, id: IdPath):
    """
    RN-24: atiende una solicitud de cancelación de datos personales. Es
    irreversible: la cuenta queda eliminada, sin nombre, correo ni acceso.
    """
    if id == yo['id']:
        raise AppError.bad_request('No puedes anonimizar tu propia cuenta')
    with transaction() as conn:
        actual = conn.execute(
            'SELECT fecha_anonimizacion FROM usuarios WHERE id = %s FOR UPDATE', (id,)
        ).fetchone()
        if not actual:
            raise AppError.not_found('Usuario no encontrado')
        if actual['fecha_anonimizacion']:
            raise AppError.conflict('La cuenta ya fue anonimizada')
        # Contraseña aleatoria que nadie conoce: la cuenta no vuelve a poder usarse.
        usuario = users.anonimizar(conn, id, hash_password(secrets.token_urlsafe(32)))
    return {'usuario': usuario}


# --- Historial y métricas (propio usuario o admin) -------------------------

@router.get('/{id}/history')
def historial(yo: Usuario, id: IdPath, q: Annotated[HistorialQuery, Query()]):
    exigir_propio_o_admin(yo, id)
    _existente(id)
    return metrics.historial(id, q.pagina, q.limite, q.tipo)


@router.get('/{id}/metrics')
def metricas(yo: Usuario, id: IdPath):
    exigir_propio_o_admin(yo, id)
    _existente(id)
    with pool.connection() as conn:
        # Probabilidad de error estimada por subcategoría, de mayor a menor (RN-07).
        return {**metrics.metricas(id), 'predicciones': predictions.del_usuario(conn, id)}


# --- Perfil (propio usuario o admin) ---------------------------------------

@router.get('/{id}')
def obtener(yo: Usuario, id: IdPath):
    exigir_propio_o_admin(yo, id)
    return {'usuario': _existente(id)}


@router.put('/{id}')
def actualizar(yo: Usuario, id: IdPath, datos: ActualizarIn):
    exigir_propio_o_admin(yo, id)
    es_propio = yo['id'] == id
    es_admin = yo['rol'] == 'administrador'

    if (datos.rol or datos.estado) and not es_admin:
        raise AppError.forbidden('Solo un administrador puede cambiar el rol o el estado')
    # Evita que un administrador se quite el rol o desactive su propia cuenta por accidente.
    if es_propio and ((datos.rol and datos.rol != 'administrador') or (datos.estado and datos.estado != 'activa')):
        raise AppError.bad_request('No puedes quitarte el rol de administrador ni desactivar tu propia cuenta')

    actual = _existente(id)
    if actual['fecha_anonimizacion']:
        raise AppError.conflict('La cuenta fue anonimizada y ya no puede modificarse ni restaurarse')
    cambios ={k: v for k, v in datos.model_dump(include={'nombre', 'correo', 'rol', 'estado'}).items() if v is not None}
    if actual['estado'] == 'eliminada' and datos.estado:
        cambios['fecha_eliminacion'] = None  # restauración

    if datos.password_nueva:
        # El propio usuario debe confirmar su contraseña actual; un admin puede
        # restablecer la de otra persona sin conocerla.
        if es_propio:
            if not datos.password_actual:
                raise AppError.bad_request('Para cambiar la contraseña debes enviar la contraseña actual')
            if not verificar_password(datos.password_actual, users.get_password_hash(id) or ''):
                raise AppError.bad_request('La contraseña actual es incorrecta')
        cambios['password_hash'] = hash_password(datos.password_nueva)
    if datos.correo and datos.correo != actual['correo']:
        _asegurar_correo_libre(datos.correo, id)

    usuario = users.actualizar(id, cambios)
    # Cambiar la contraseña invalida los tokens anteriores; el propio usuario
    # recibe uno nuevo para no cerrar su sesión actual.
    if datos.password_nueva and es_propio:
        return {'usuario': usuario, 'token': firmar_token(usuario, users.get_token_version(id))}
    return {'usuario': usuario}
