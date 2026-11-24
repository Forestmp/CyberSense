"""
Predicciones de error por subcategoría (RN-06, RN-07, RN-08).

Cada evaluación del usuario (el examen diagnóstico y cada simulación
finalizada) produce un puntaje de 0 a 1 en una subcategoría. Mientras no haya
una versión activa del modelo de regresión se usa el criterio del baseline:
el puntaje esperado es el último puntaje obtenido en la subcategoría.
probabilidad de error = 1 − puntaje esperado.
"""
from psycopg import Connection

# Último puntaje (0 a 1) del usuario en cada subcategoría, tomando el
# diagnóstico y las simulaciones finalizadas en orden cronológico.
_ULTIMOS_PUNTAJES = """
  SELECT DISTINCT ON (subcategoria_id) subcategoria_id, puntaje
    FROM (
      SELECT p.subcategoria_id, o.puntuacion::float AS puntaje, e.fecha_fin AS fecha
        FROM examenes_diagnostico e
        JOIN respuestas_diagnostico r ON r.examen_id = e.id
        JOIN preguntas_diagnostico p ON p.id = r.pregunta_id
        JOIN opciones_diagnostico o ON o.id = r.opcion_id
       WHERE e.usuario_id = %(u)s AND e.estado = 'finalizado'
      UNION ALL
      SELECT es.subcategoria_id, (i.puntaje / 100)::float, i.fecha_fin
        FROM intentos i JOIN escenarios es ON es.id = i.escenario_id
       WHERE i.usuario_id = %(u)s AND i.estado = 'finalizado'
    ) evaluaciones
   ORDER BY subcategoria_id, fecha DESC"""


def recalcular(conn: Connection, usuario_id: int):
    """Recalcula y guarda la predicción del usuario en cada subcategoría que ya tiene evaluaciones."""
    for fila in conn.execute(_ULTIMOS_PUNTAJES, {'u': usuario_id}).fetchall():
        esperado = round(min(1.0, max(0.0, fila['puntaje'])), 3)
        conn.execute(
            """INSERT INTO predicciones_error
                 (usuario_id, subcategoria_id, puntaje_esperado, probabilidad_error, modelo_id, fecha_calculo)
               VALUES (%s, %s, %s, %s, NULL, now())
               ON CONFLICT (usuario_id, subcategoria_id) DO UPDATE SET
                 puntaje_esperado = EXCLUDED.puntaje_esperado, probabilidad_error = EXCLUDED.probabilidad_error,
                 modelo_id = EXCLUDED.modelo_id, fecha_calculo = now()""",
            (usuario_id, fila['subcategoria_id'], esperado, round(1 - esperado, 3)),
        )


def del_usuario(conn: Connection, usuario_id: int) -> list[dict]:
    return conn.execute(
        """SELECT sc.clave AS subcategoria, sc.nombre AS subcategoria_nombre, t.clave AS tipo,
                  pe.puntaje_esperado, pe.probabilidad_error, pe.modelo_id, pe.fecha_calculo
             FROM predicciones_error pe
             JOIN subcategorias sc ON sc.id = pe.subcategoria_id
             JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
            WHERE pe.usuario_id = %s
            ORDER BY pe.probabilidad_error DESC, sc.id""",
        (usuario_id,),
    ).fetchall()
