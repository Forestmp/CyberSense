"""Reglas de negocio de escenarios: creación, edición, estado y eliminación lógica."""
from psycopg import Connection

from app.db import transaction
from app.errors import AppError
from app.modules import scenarios_repo as repo
from app.modules.scenarios_structure import validar_estructura


def _validar_documento(conn: Connection, doc: dict) -> dict:
    errores = validar_estructura(doc)
    cat = repo.resolver_catalogos(conn, doc['subcategoria'], doc['dificultad'])
    if not cat['subcategoria_id']:
        errores.append(f"Subcategoría desconocida: {doc['subcategoria']}")
    if not cat['dificultad_id']:
        errores.append(f"Dificultad desconocida: {doc['dificultad']}")
    if errores:
        raise AppError.bad_request('La estructura del escenario no es válida',
                                   [{'campo': 'body', 'mensaje': m} for m in errores])
    return cat


def crear(doc: dict, usuario_id: int | None) -> dict:
    with transaction() as conn:
        cat = _validar_documento(conn, doc)
        id_ = repo.crear(conn, doc, cat, usuario_id)
    return repo.obtener_documento(id_)


def actualizar(id_: int, doc: dict) -> dict:
    """
    Reemplaza el contenido del escenario. Los intentos en curso se marcan como
    abandonados porque su paso actual puede haber cambiado o desaparecido.
    """
    with transaction() as conn:
        fila = conn.execute('SELECT estado FROM escenarios WHERE id = %s FOR UPDATE', (id_,)).fetchone()
        if not fila or fila['estado'] == 'eliminado':
            raise AppError.not_found('Escenario no encontrado')
        cat = _validar_documento(conn, doc)
        repo.actualizar_metadatos(conn, id_, doc, cat)
        repo.reemplazar_estructura(conn, id_, doc)
        conn.execute(
            """UPDATE intentos SET estado = 'abandonado', fecha_fin = now()
                WHERE escenario_id = %s AND estado = 'en_curso'""",
            (id_,),
        )
    return repo.obtener_documento(id_)


def cambiar_estado(id_: int, estado: str) -> dict:
    actual = repo.obtener_resumen(id_)
    if not actual or actual['estado'] == 'eliminado':
        raise AppError.not_found('Escenario no encontrado')
    repo.cambiar_estado(id_, estado)
    return repo.obtener_resumen(id_)


def eliminar(id_: int):
    """Eliminación lógica: el escenario deja de mostrarse, pero su historial se conserva."""
    with transaction() as conn:
        fila = conn.execute(
            "UPDATE escenarios SET estado = 'eliminado' WHERE id = %s AND estado <> 'eliminado' RETURNING id", (id_,)
        ).fetchone()
        if not fila:
            raise AppError.not_found('Escenario no encontrado')
        conn.execute(
            """UPDATE intentos SET estado = 'abandonado', fecha_fin = now()
                WHERE escenario_id = %s AND estado = 'en_curso'""",
            (id_,),
        )
