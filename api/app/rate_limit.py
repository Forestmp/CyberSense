"""Límite de peticiones por IP en memoria (ventana deslizante)."""
import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.config import settings
from app.errors import AppError


def ip_cliente(request: Request) -> str:
    """IP real del cliente: con TRUST_PROXY = n se toma la n-ésima desde el final de X-Forwarded-For."""
    if settings.TRUST_PROXY:
        ips = [ip.strip() for ip in request.headers.get('x-forwarded-for', '').split(',') if ip.strip()]
        if len(ips) >= settings.TRUST_PROXY:
            return ips[-settings.TRUST_PROXY]
    return request.client.host if request.client else 'desconocida'


class Limitador:
    def __init__(self, limite: int, ventana_seg: int, mensaje: str):
        self.limite = limite
        self.ventana = ventana_seg
        self.mensaje = mensaje
        self._registros: dict[str, deque] = defaultdict(deque)
        self._candado = threading.Lock()

    def __call__(self, request: Request):
        if settings.ENV == 'test':
            return
        ahora = time.monotonic()
        with self._candado:
            marcas = self._registros[ip_cliente(request)]
            while marcas and marcas[0] <= ahora - self.ventana:
                marcas.popleft()
            if len(marcas) >= self.limite:
                raise AppError(429, self.mensaje, 'TOO_MANY_REQUESTS')
            marcas.append(ahora)


class BloqueoPorCorreo:
    """
    RN-28: tras `limite` inicios de sesión fallidos de un mismo correo dentro de
    la ventana, se rechazan los siguientes intentos de ese correo hasta que
    venza. Se cuenta aunque el correo no exista, para no revelar qué cuentas
    están registradas. Un inicio de sesión correcto reinicia el conteo.
    """

    def __init__(self, limite: int, ventana_seg: int, mensaje: str):
        self.limite = limite
        self.ventana = ventana_seg
        self.mensaje = mensaje
        self._fallos: dict[str, deque] = defaultdict(deque)
        self._candado = threading.Lock()

    def _vigentes(self, correo: str) -> deque:
        ahora = time.monotonic()
        marcas = self._fallos[correo.lower()]
        while marcas and marcas[0] <= ahora - self.ventana:
            marcas.popleft()
        return marcas

    def verificar(self, correo: str):
        with self._candado:
            if len(self._vigentes(correo)) >= self.limite:
                raise AppError(429, self.mensaje, 'CUENTA_BLOQUEADA_TEMPORALMENTE')

    def registrar_fallo(self, correo: str):
        with self._candado:
            self._vigentes(correo).append(time.monotonic())

    def reiniciar(self, correo: str):
        with self._candado:
            self._fallos.pop(correo.lower(), None)
