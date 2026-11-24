"""Rutas del examen diagnóstico."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.modules import diagnostic_service as service
from app.security import Usuario

router = APIRouter(prefix='/api/diagnostic', tags=['diagnostic'])


class ResponderIn(BaseModel):
    opcion_id: int = Field(gt=0)


@router.get('')
def obtener(yo: Usuario):
    """Estado del examen del usuario: sin iniciar, pregunta actual o resultado."""
    return service.obtener(yo['id'])


@router.post('/start')
def iniciar(yo: Usuario):
    return service.iniciar(yo['id'])


@router.post('/answers')
def responder(yo: Usuario, datos: ResponderIn):
    return service.responder(yo['id'], datos.opcion_id)
