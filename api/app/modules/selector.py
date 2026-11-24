"""
Selección del siguiente escenario.

Punto de extensión para el motor adaptativo: cada estrategia recibe los
candidatos con el contexto del usuario y devuelve {escenario, motivo}. Hoy
solo existe una estrategia provisional basada en reglas simples; cuando exista
el modelo de regresión se agregará una estrategia que use la probabilidad de
error estimada por escenario, sin cambiar la API.
"""
from app.db import query


def _contexto(usuario_id: int) -> list[dict]:
    return query(
        """SELECT e.id, e.codigo, e.titulo, t.clave AS tipo, t.nombre AS tipo_nombre,
                  sc.clave AS subcategoria, sc.nombre AS subcategoria_nombre, d.valor AS dificultad,
                  m.puntaje_promedio AS promedio_tipo,
                  (SELECT count(*)::int FROM intentos i
                    WHERE i.usuario_id = %(u)s AND i.escenario_id = e.id AND i.estado = 'finalizado') AS completados,
                  (SELECT i.puntaje FROM intentos i
                    WHERE i.usuario_id = %(u)s AND i.escenario_id = e.id AND i.estado = 'finalizado'
                    ORDER BY i.fecha_fin DESC LIMIT 1)::float AS ultimo_puntaje
             FROM escenarios e
             JOIN subcategorias sc ON sc.id = e.subcategoria_id
             JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
             JOIN niveles_dificultad d ON d.id = e.dificultad_id
             LEFT JOIN metricas_usuario m ON m.usuario_id = %(u)s AND m.subcategoria_id = e.subcategoria_id
            WHERE e.estado = 'activo'""",
        {'u': usuario_id},
    )


def _reglas_provisional(candidatos: list[dict]) -> dict | None:
    """
    Escenarios no realizados, del tipo con menor promedio y menor dificultad.
    RN-10: nunca recomienda un escenario ya completado; si el usuario los
    completó todos, no hay recomendación.
    """
    def promedio(c):  # sin datos = prioridad
        return -1 if c['promedio_tipo'] is None else c['promedio_tipo']

    nuevos = sorted((c for c in candidatos if c['completados'] == 0),
                    key=lambda c: (promedio(c), c['dificultad'], c['codigo']))
    if not nuevos:
        return None
    c = nuevos[0]
    motivo = (f"Aún no practicas {c['subcategoria_nombre'].lower()}" if c['promedio_tipo'] is None
              else 'Escenario que aún no has realizado')
    return {'escenario': c, 'motivo': motivo}


ESTRATEGIAS = {'reglas-provisional': _reglas_provisional}
ESTRATEGIA_ACTUAL = 'reglas-provisional'


def seleccionar_siguiente(usuario_id: int, estrategia: str = ESTRATEGIA_ACTUAL) -> dict | None:
    r = ESTRATEGIAS[estrategia](_contexto(usuario_id))
    if not r:
        return None
    e = r['escenario']
    return {
        'escenario': {k: e[k] for k in ('id', 'codigo', 'titulo', 'tipo', 'tipo_nombre',
                                         'subcategoria', 'subcategoria_nombre')},
        'motivo': r['motivo'],
        'estrategia': estrategia,
    }
