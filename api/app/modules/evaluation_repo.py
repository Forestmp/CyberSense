"""Datos de configuración que usa el motor de evaluación."""
from psycopg import Connection

from app.db import query


def _ejecutar(sql: str, conn: Connection | None) -> list[dict]:
    return conn.execute(sql).fetchall() if conn else query(sql)


def rangos_activos(conn: Connection | None = None) -> list[dict]:
    return _ejecutar(
        """SELECT version, nivel, nombre, puntaje_min, puntaje_max, descripcion, recomendacion
             FROM rangos_vulnerabilidad WHERE activo ORDER BY puntaje_min""",
        conn,
    )


def reglas_globales(conn: Connection | None = None) -> list[dict]:
    return _ejecutar(
        """SELECT tipo_regla, parametros, ajuste_puntuacion, descripcion, retroalimentacion, activa
             FROM reglas_evaluacion WHERE escenario_id IS NULL AND activa ORDER BY prioridad, id""",
        conn,
    )
