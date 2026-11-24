"""Historial y métricas de desempeño del usuario."""
import math

from app.db import query, query_one
from app.modules.engine import clasificar
from app.modules.evaluation_repo import rangos_activos
from app.schemas import paginado


def historial(usuario_id: int, pagina: int, limite: int, tipo: str | None) -> dict:
    params: list = [usuario_id]
    filtro = ''
    if tipo:
        params.append(tipo)
        filtro = 'AND t.clave = %s'
    desde = f"""
      FROM intentos i
      JOIN escenarios e ON e.id = i.escenario_id
      JOIN subcategorias sc ON sc.id = e.subcategoria_id
      JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
      JOIN niveles_dificultad d ON d.id = e.dificultad_id
     WHERE i.usuario_id = %s AND i.estado = 'finalizado' {filtro}"""

    total = query_one(f'SELECT count(*)::int AS n {desde}', params)['n']
    filas = query(
        f"""SELECT i.id AS intento_id, i.numero_intento, i.fecha_inicio, i.fecha_fin, i.duracion_ms,
                   i.puntaje, i.nivel_vulnerabilidad, i.aciertos, i.errores, i.senales_detectadas, i.senales_totales,
                   e.id AS escenario_id, e.codigo, e.titulo, t.clave AS tipo, t.nombre AS tipo_nombre,
                   sc.clave AS subcategoria, sc.nombre AS subcategoria_nombre, d.clave AS dificultad, d.nombre AS dificultad_nombre
            {desde}
            ORDER BY i.fecha_fin DESC, i.id DESC
            LIMIT %s OFFSET %s""",
        [*params, limite, (pagina - 1) * limite],
    )
    return paginado(filas, total, pagina, limite)


def metricas(usuario_id: int) -> dict:
    rangos = rangos_activos()

    por_subcategoria = query(
        """SELECT sc.clave AS subcategoria, sc.nombre AS subcategoria_nombre, t.clave AS tipo,
                  COALESCE(m.total_intentos, 0) AS total_intentos, COALESCE(m.aciertos, 0) AS aciertos,
                  COALESCE(m.errores, 0) AS errores, m.puntaje_promedio, m.ultimo_puntaje, m.nivel_vulnerabilidad,
                  m.ultima_actualizacion
             FROM subcategorias sc
             JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
             LEFT JOIN metricas_usuario m ON m.subcategoria_id = sc.id AND m.usuario_id = %s
            ORDER BY sc.id""",
        (usuario_id,),
    )

    # Resumen por tipo de ataque, calculado sobre los intentos de sus subcategorías.
    por_tipo = query(
        """SELECT t.clave AS tipo, t.nombre AS tipo_nombre,
                  count(i.id)::int AS total_intentos, COALESCE(sum(i.aciertos), 0)::int AS aciertos,
                  COALESCE(sum(i.errores), 0)::int AS errores, round(avg(i.puntaje), 2)::float AS puntaje_promedio
             FROM tipos_ataque t
             LEFT JOIN subcategorias sc ON sc.tipo_ataque_id = t.id
             LEFT JOIN escenarios e ON e.subcategoria_id = sc.id
             LEFT JOIN intentos i ON i.escenario_id = e.id AND i.usuario_id = %s AND i.estado = 'finalizado'
            GROUP BY t.id ORDER BY t.id""",
        (usuario_id,),
    )
    for t in por_tipo:
        rango = clasificar(t['puntaje_promedio'], rangos) if t['puntaje_promedio'] is not None else None
        t['nivel_vulnerabilidad'] = rango['nivel'] if rango else None

    g = query_one(
        """SELECT count(*)::int AS total_simulaciones,
                  count(DISTINCT i.escenario_id)::int AS escenarios_completados,
                  round(avg(i.puntaje), 2)::float AS puntaje_promedio,
                  COALESCE(sum(i.aciertos), 0)::int AS aciertos,
                  COALESCE(sum(i.errores), 0)::int AS errores,
                  (SELECT count(*)::int FROM escenarios WHERE estado = 'activo') AS escenarios_disponibles
             FROM intentos i WHERE i.usuario_id = %s AND i.estado = 'finalizado'""",
        (usuario_id,),
    )

    evolucion = query(
        """SELECT * FROM (
             SELECT i.id AS intento_id, i.fecha_fin, i.puntaje, e.codigo
               FROM intentos i JOIN escenarios e ON e.id = i.escenario_id
              WHERE i.usuario_id = %s AND i.estado = 'finalizado'
              ORDER BY i.fecha_fin DESC LIMIT 10) x
           ORDER BY fecha_fin""",
        (usuario_id,),
    )

    decisiones = g['aciertos'] + g['errores']
    nivel = clasificar(g['puntaje_promedio'], rangos) if g['puntaje_promedio'] is not None else None
    return {
        'resumen': {
            **g,
            'tasa_aciertos': math.floor(g['aciertos'] / decisiones * 100 + 0.5) if decisiones else None,
            'nivel_vulnerabilidad': nivel['nivel'] if nivel else None,
        },
        'por_tipo': por_tipo,
        'por_subcategoria': por_subcategoria,
        'evolucion': evolucion,
    }


def estadisticas_por_escenario(usuario_id: int) -> dict[int, dict]:
    """Estadísticas del usuario por escenario (para el listado de simulaciones)."""
    filas = query(
        """SELECT escenario_id, count(*)::int AS intentos, max(puntaje)::float AS mejor_puntaje,
                  (array_agg(puntaje ORDER BY fecha_fin DESC))[1]::float AS ultimo_puntaje,
                  (array_agg(nivel_vulnerabilidad ORDER BY fecha_fin DESC))[1] AS ultimo_nivel
             FROM intentos WHERE usuario_id = %s AND estado = 'finalizado'
            GROUP BY escenario_id""",
        (usuario_id,),
    )
    return {f['escenario_id']: f for f in filas}
