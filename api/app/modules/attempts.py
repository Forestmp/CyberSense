"""Rutas de intentos (ejecución de simulaciones)."""
from typing import Annotated

from fastapi import APIRouter, Path, Response
from pydantic import BaseModel, Field

from app.modules import attempts_service as service
from app.security import Usuario

router = APIRouter(prefix='/api/attempts', tags=['attempts'])

IdPath = Annotated[int, Path(gt=0)]


class IniciarIn(BaseModel):
    escenario_id: int = Field(gt=0)


class ResponderIn(BaseModel):
    opcion_id: int = Field(gt=0)


@router.post('', status_code=201)
def iniciar(yo: Usuario, datos: IniciarIn):
    return service.iniciar(yo['id'], datos.escenario_id)


@router.get('/{id}')
def obtener(yo: Usuario, id: IdPath):
    return service.obtener(yo, id)


@router.post('/{id}/responses', status_code=201)
def responder(yo: Usuario, id: IdPath, datos: ResponderIn):
    return service.responder(yo['id'], id, datos.opcion_id)


@router.post('/{id}/finish')
def finalizar(yo: Usuario, id: IdPath):
    return service.finalizar(yo['id'], id)


@router.post('/{id}/confirm-feedback')
def confirmar_retroalimentacion(yo: Usuario, id: IdPath):
    return service.confirmar_retroalimentacion(yo['id'], id)


@router.post('/{id}/abandon', status_code=204)
def abandonar(yo: Usuario, id: IdPath):
    service.abandonar(yo['id'], id)
    return Response(status_code=204)
