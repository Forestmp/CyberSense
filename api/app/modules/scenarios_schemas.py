"""Esquemas del documento de escenario (payload de POST/PUT /api/scenarios)."""
import re
from typing import Annotated, Literal, Union

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, field_validator

TIPOS_ACCION = ['segura', 'neutral', 'mejorable', 'riesgosa', 'critica']
FORMATOS = ['correo', 'sms', 'sitio_web', 'llamada', 'mensaje_chat', 'detalle_remitente', 'detalle_url', 'texto']
ESTADOS = ['borrador', 'activo', 'inactivo']

TipoAccion = Literal['segura', 'neutral', 'mejorable', 'riesgosa', 'critica']
Estado = Literal['borrador', 'activo', 'inactivo']

_RE_CLAVE = re.compile(r'^[a-z0-9_]{2,40}$')


def _clave(v):
    if not isinstance(v, str) or not _RE_CLAVE.match(v.strip()):
        raise ValueError('Usa de 2 a 40 caracteres: minúsculas, números o guion bajo')
    return v.strip()


def Texto(maximo: int, minimo: int = 1):
    def validar(v):
        if not isinstance(v, str):
            raise ValueError('Debe ser texto')
        v = v.strip()
        if len(v) < minimo:
            raise ValueError('Campo obligatorio')
        if len(v) > maximo:
            raise ValueError(f'Máximo {maximo} caracteres')
        return v
    return Annotated[str, BeforeValidator(validar)]


def _texto_opcional(maximo: int):
    def validar(v):
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError('Debe ser texto')
        v = v.strip()
        if len(v) > maximo:
            raise ValueError(f'Máximo {maximo} caracteres')
        return v
    return Annotated[str | None, BeforeValidator(validar)]


Clave = Annotated[str, BeforeValidator(_clave)]


def _contenido_paso(v):
    """El formato decide cómo lo muestra la app; los demás campos son texto, booleano o lista corta de textos."""
    if not isinstance(v, dict):
        raise ValueError('Debe ser un objeto')
    if v.get('formato') not in FORMATOS:
        raise ValueError('Formato de contenido no válido')
    for k, x in v.items():
        if k == 'formato' or isinstance(x, bool):
            continue
        if isinstance(x, str):
            if len(x) > 4000:
                raise ValueError(f'{k}: máximo 4000 caracteres')
        elif isinstance(x, list):
            if len(x) > 20 or not all(isinstance(i, str) and len(i) <= 200 for i in x):
                raise ValueError(f'{k}: lista de hasta 20 textos de 200 caracteres')
        else:
            raise ValueError(f'{k}: debe ser texto, booleano o lista de textos')
    return v


def _contenido_escenario(v):
    if v is None:
        return {}
    if not isinstance(v, dict):
        raise ValueError('Debe ser un objeto')
    for k, x in v.items():
        if not isinstance(x, str) or len(x) > 2000:
            raise ValueError(f'{k}: texto de máximo 2000 caracteres')
    if 'contexto' in v:
        v = {**v, 'contexto': v['contexto'].strip()}
    return v


class Senal(BaseModel):
    clave: Clave
    descripcion: Texto(200, 3)
    explicacion: Texto(2000, 3)


class Opcion(BaseModel):
    clave: Clave
    texto: Texto(300)
    tipo_accion: TipoAccion
    puntuacion: int = Field(ge=-100, le=100, strict=True)
    retroalimentacion: Texto(2000)
    siguiente_paso: Clave | None = None
    senales: list[Clave] = Field(default_factory=list, max_length=10)


class Paso(BaseModel):
    clave: Clave
    titulo: Texto(150)
    pregunta: Texto(500)
    es_inicial: bool = False
    contenido: Annotated[dict, AfterValidator(_contenido_paso)]
    opciones: list[Opcion] = Field(max_length=8)

    @field_validator('opciones')
    @classmethod
    def _minimo(cls, v):
        if len(v) < 2:
            raise ValueError('Cada paso necesita al menos 2 opciones')
        return v


class _ReglaBase(BaseModel):
    ajuste_puntuacion: int = Field(0, ge=-10, le=10, strict=True)   # RN-03
    descripcion: Texto(200, 3)
    retroalimentacion: _texto_opcional(2000) = None
    activa: bool = True


class ParamOpcion(BaseModel):
    opcion: Clave


class ParamTipo(BaseModel):
    tipo_accion: TipoAccion


class ParamConteo(BaseModel):
    tipo_accion: TipoAccion
    minimo: int = Field(ge=1, le=20, strict=True)


class ParamSecuencia(BaseModel):
    opciones: list[Clave] = Field(min_length=2, max_length=5)


class ReglaOpcion(_ReglaBase):
    tipo_regla: Literal['OPCION_SELECCIONADA']
    parametros: ParamOpcion


class ReglaTipo(_ReglaBase):
    tipo_regla: Literal['TIPO_ACCION_PRESENTE']
    parametros: ParamTipo


class ReglaConteo(_ReglaBase):
    tipo_regla: Literal['CONTEO_TIPO_ACCION']
    parametros: ParamConteo


class ReglaSecuencia(_ReglaBase):
    tipo_regla: Literal['SECUENCIA']
    parametros: ParamSecuencia


Regla = Annotated[Union[ReglaOpcion, ReglaTipo, ReglaConteo, ReglaSecuencia], Field(discriminator='tipo_regla')]


class EscenarioDoc(BaseModel):
    titulo: Texto(150, 3)
    subcategoria: Clave
    dificultad: Clave
    descripcion: Texto(1000, 3)
    contenido: Annotated[dict, BeforeValidator(_contenido_escenario)] = Field(default_factory=dict)
    retroalimentacion_general: _texto_opcional(2000) = None
    estado: Estado = 'borrador'
    senales: list[Senal] = Field(default_factory=list, max_length=20)
    pasos: list[Paso] = Field(max_length=20)
    reglas: list[Regla] = Field(default_factory=list, max_length=30)

    @field_validator('pasos')
    @classmethod
    def _al_menos_uno(cls, v):
        if not v:
            raise ValueError('El escenario necesita al menos un paso')
        return v


class ListaQuery(BaseModel):
    pagina: int = Field(1, ge=1)
    limite: int = Field(50, ge=1, le=100)
    buscar: str | None = Field(None, max_length=100)
    tipo: Clave | None = None
    subcategoria: Clave | None = None
    dificultad: Clave | None = None
    estado: Literal['borrador', 'activo', 'inactivo', 'eliminado'] | None = None


class PatchIn(BaseModel):
    model_config = {'extra': 'forbid'}
    estado: Estado
