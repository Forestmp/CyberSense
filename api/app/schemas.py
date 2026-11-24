"""Tipos de validación compartidos por varios módulos."""
import re
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator

# Misma expresión que usa zod para correos (la API anterior), para aceptar exactamente lo mismo.
_RE_CORREO = re.compile(
    r"^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$"
)
_RE_LETRA = re.compile(r'[A-Za-zÁÉÍÓÚÑáéíóúñ]')


def _texto(v):
    if not isinstance(v, str):
        raise ValueError('Debe ser texto')
    return v


def _correo(v: str) -> str:
    v = v.strip().lower()
    if not _RE_CORREO.match(v) or len(v) > 254:
        raise ValueError('Correo electrónico inválido')
    return v


def _password(v: str) -> str:
    if len(v) < 8:
        raise ValueError('La contraseña debe tener al menos 8 caracteres')
    # bcrypt solo considera los primeros 72 bytes, de ahí el máximo.
    if len(v.encode()) > 72:
        raise ValueError('La contraseña es demasiado larga')
    if not (_RE_LETRA.search(v) and re.search(r'\d', v)):
        raise ValueError('La contraseña debe incluir letras y números')
    return v


def _nombre(v: str) -> str:
    v = v.strip()
    if len(v) < 2:
        raise ValueError('El nombre debe tener al menos 2 caracteres')
    if len(v) > 100:
        raise ValueError('Máximo 100 caracteres')
    return v


Correo = Annotated[str, BeforeValidator(_texto), AfterValidator(_correo)]
Password = Annotated[str, BeforeValidator(_texto), AfterValidator(_password)]
Nombre = Annotated[str, BeforeValidator(_texto), AfterValidator(_nombre)]


def escapar_like(texto: str) -> str:
    """Escapa los comodines de ILIKE para buscar el texto literal."""
    return re.sub(r'([\\%_])', r'\\\1', texto)


def paginado(datos: list, total: int, pagina: int, limite: int) -> dict:
    return {'datos': datos, 'total': total, 'pagina': pagina, 'limite': limite, 'paginas': -(-total // limite)}
