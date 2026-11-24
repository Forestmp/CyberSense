"""Rutas de escenarios y catálogos."""
from typing import Annotated

from fastapi import APIRouter, Path, Query, Response

from app.errors import AppError
from app.modules import metrics_repo as metrics
from app.modules import scenarios_repo as repo
from app.modules import scenarios_service as service
from app.modules.scenarios_schemas import FORMATOS, TIPOS_ACCION, EscenarioDoc, ListaQuery, PatchIn
from app.modules.selector import seleccionar_siguiente
from app.security import Admin, Usuario

router = APIRouter(prefix='/api/scenarios', tags=['scenarios'])
catalogos_router = APIRouter(prefix='/api/catalogos', tags=['catalogos'])

IdPath = Annotated[int, Path(gt=0)]


@catalogos_router.get('')
def catalogos(_: Usuario):
    """Catálogos para formularios y filtros de la app."""
    return {
        **repo.catalogos(),
        'tipos_accion': TIPOS_ACCION,
        'formatos_contenido': FORMATOS,
        'tipos_regla': ['OPCION_SELECCIONADA', 'TIPO_ACCION_PRESENTE', 'CONTEO_TIPO_ACCION', 'SECUENCIA'],
    }


@router.get('')
def listar(yo: Usuario, q: Annotated[ListaQuery, Query()]):
    """
    Usuarios: solo escenarios activos (resumen, sin opciones ni puntuaciones).
    Admin: todos salvo eliminados, filtrables por estado.
    """
    buscar = q.buscar.strip() if q.buscar else None
    lista = repo.listar(q.pagina, q.limite, buscar, q.tipo, q.subcategoria, q.dificultad, q.estado,
                        solo_activos=yo['rol'] != 'administrador')
    # Cada escenario incluye el desempeño del propio usuario en él.
    stats = metrics.estadisticas_por_escenario(yo['id'])
    for e in lista['datos']:
        s = stats.get(e['id'], {})
        e['mis_intentos'] = s.get('intentos', 0)
        e['mi_mejor_puntaje'] = s.get('mejor_puntaje')
        e['mi_ultimo_nivel'] = s.get('ultimo_nivel')
    return lista


@router.get('/recommended')
def recomendado(yo: Usuario):
    """Siguiente escenario sugerido (punto de extensión del motor adaptativo)."""
    return {'recomendacion': seleccionar_siguiente(yo['id'])}


@router.get('/{id}')
def obtener(yo: Usuario, id: IdPath):
    """
    Admin: documento completo (pasos, opciones, puntuaciones, reglas).
    Usuario: solo el resumen de un escenario activo; los pasos se entregan uno
    a uno durante el intento para no revelar las respuestas.
    """
    if yo['rol'] == 'administrador':
        doc = repo.obtener_documento(id)
        if not doc:
            raise AppError.not_found('Escenario no encontrado')
        return {'escenario': doc}
    resumen = repo.obtener_resumen(id)
    if not resumen or resumen['estado'] != 'activo':
        raise AppError.not_found('Escenario no encontrado')
    return {'escenario': resumen}


@router.post('', status_code=201)
def crear(yo: Admin, doc: EscenarioDoc):
    return {'escenario': service.crear(doc.model_dump(), yo['id'])}


@router.put('/{id}')
def actualizar(_: Admin, id: IdPath, doc: EscenarioDoc):
    return {'escenario': service.actualizar(id, doc.model_dump())}


@router.patch('/{id}')
def cambiar_estado(_: Admin, id: IdPath, datos: PatchIn):
    """Cambio rápido de estado (activar / desactivar / borrador)."""
    return {'escenario': service.cambiar_estado(id, datos.estado)}


@router.delete('/{id}', status_code=204)
def eliminar(_: Admin, id: IdPath):
    service.eliminar(id)
    return Response(status_code=204)
