"""Ejecución de simulaciones: iniciar, responder, finalizar, confirmar y abandonar intentos."""
from psycopg import Connection
from psycopg.types.json import Jsonb

from app.db import pool, transaction
from app.errors import AppError
from app.modules import evaluation_repo, predictions, scenarios_repo
from app.modules.engine import clasificar, evaluar


def _paso_publico(conn: Connection, paso_id: int | None) -> dict | None:
    """
    Paso tal como lo ve el usuario: contenido simulado, pregunta y textos de
    las opciones. Nunca incluye tipo de acción, puntuación ni retroalimentación.
    """
    if not paso_id:
        return None
    paso = conn.execute(
        'SELECT id, titulo, pregunta, contenido FROM escenario_pasos WHERE id = %s', (paso_id,)
    ).fetchone()
    if not paso:
        return None
    paso['opciones'] = conn.execute(
        'SELECT id, texto FROM opciones WHERE paso_id = %s ORDER BY orden', (paso_id,)
    ).fetchall()
    return paso


def _bloquear_intento(conn: Connection, intento_id: int, usuario_id: int) -> dict:
    intento = conn.execute('SELECT * FROM intentos WHERE id = %s FOR UPDATE', (intento_id,)).fetchone()
    if not intento or intento['usuario_id'] != usuario_id:
        raise AppError.not_found('Intento no encontrado')
    return intento


def _resumen_intento(i: dict, decisiones: int | None) -> dict:
    return {
        'id': i['id'],
        'escenario_id': i['escenario_id'],
        'numero_intento': i['numero_intento'],
        'estado': i['estado'],
        'fecha_inicio': i['fecha_inicio'],
        'fecha_fin': i['fecha_fin'],
        'decisiones_tomadas': decisiones,
        'terminado': i['paso_actual_id'] is None if i['estado'] == 'en_curso' else i['estado'] == 'finalizado',
        'resultado_revisado': i['retroalimentacion_confirmada_en'] is not None,
    }


def _escenario_publico(e: dict, con_descripcion: bool) -> dict:
    claves = ['id', 'codigo', 'titulo', *(['descripcion'] if con_descripcion else []),
              'tipo', 'tipo_nombre', 'subcategoria', 'subcategoria_nombre', 'dificultad', 'dificultad_nombre']
    return {**{k: e[k] for k in claves}, 'contexto': (e.get('contenido') or {}).get('contexto')}


def _retroalimentacion_pendiente(conn: Connection, usuario_id: int) -> dict | None:
    """RN-13: intento finalizado cuya retroalimentación el usuario aún no confirma."""
    return conn.execute(
        """SELECT id FROM intentos
            WHERE usuario_id = %s AND estado = 'finalizado' AND retroalimentacion_confirmada_en IS NULL
            ORDER BY fecha_fin DESC LIMIT 1""",
        (usuario_id,),
    ).fetchone()


def _contar_respuestas(conn: Connection, intento_id: int) -> int:
    return conn.execute(
        'SELECT count(*)::int AS n FROM respuestas_usuario WHERE intento_id = %s', (intento_id,)
    ).fetchone()['n']


def iniciar(usuario_id: int, escenario_id: int) -> dict:
    """Inicia un intento. Si el usuario tenía otro en curso, de cualquier escenario, se abandona (RN-29)."""
    with transaction() as conn:
        escenario = scenarios_repo.obtener_resumen(escenario_id, conn)
        if not escenario or escenario['estado'] != 'activo':
            raise AppError.not_found('Escenario no disponible')

        inicial = conn.execute(
            'SELECT id FROM escenario_pasos WHERE escenario_id = %s AND es_inicial', (escenario_id,)
        ).fetchone()
        if not inicial:
            raise AppError.conflict('El escenario no tiene paso inicial')

        pendiente = _retroalimentacion_pendiente(conn, usuario_id)
        if pendiente:
            raise AppError(409, 'Antes de iniciar otro escenario, revisa y confirma la retroalimentación del anterior.',
                           'RETROALIMENTACION_PENDIENTE', {'intento_id': pendiente['id']})

        # Bloqueo por usuario para que dos peticiones simultáneas no choquen en numero_intento
        # ni en el índice de un solo intento en curso.
        conn.execute('SELECT pg_advisory_xact_lock(%s::bigint)', (usuario_id,))
        conn.execute(
            """UPDATE intentos SET estado = 'abandonado', fecha_fin = now()
                WHERE usuario_id = %s AND estado = 'en_curso'""",
            (usuario_id,),
        )
        intento = conn.execute(
            """INSERT INTO intentos (usuario_id, escenario_id, numero_intento, paso_actual_id)
               VALUES (%(u)s, %(e)s, (SELECT count(*) + 1 FROM intentos WHERE usuario_id = %(u)s AND escenario_id = %(e)s), %(p)s)
               RETURNING *""",
            {'u': usuario_id, 'e': escenario_id, 'p': inicial['id']},
        ).fetchone()

        return {
            'intento': _resumen_intento(intento, 0),
            'escenario': _escenario_publico(escenario, con_descripcion=True),
            'paso': _paso_publico(conn, inicial['id']),
        }


def responder(usuario_id: int, intento_id: int, opcion_id: int) -> dict:
    """
    Registra una decisión. No revela si fue correcta: solo devuelve el
    siguiente paso o indica que el escenario terminó.
    """
    with transaction() as conn:
        intento = _bloquear_intento(conn, intento_id, usuario_id)
        if intento['estado'] != 'en_curso':
            raise AppError.conflict('El intento ya no está en curso')
        if not intento['paso_actual_id']:
            raise AppError.conflict('No hay decisiones pendientes; finaliza el intento')

        opcion = conn.execute(
            """SELECT id, clave, texto, tipo_accion, siguiente_paso_id
                 FROM opciones WHERE id = %s AND paso_id = %s""",
            (opcion_id, intento['paso_actual_id']),
        ).fetchone()
        if not opcion:
            raise AppError.bad_request('La opción no corresponde al paso actual')

        # Tiempo de respuesta medido en el servidor desde la decisión anterior (o el inicio).
        conn.execute(
            """INSERT INTO respuestas_usuario
                 (intento_id, paso_id, opcion_id, orden, opcion_clave, texto_opcion, tipo_accion, tiempo_respuesta_ms)
               SELECT %(i)s, %(paso)s, %(op)s, count(r.id) + 1, %(clave)s, %(texto)s, %(tipo)s,
                      (EXTRACT(EPOCH FROM (now() - COALESCE(max(r.fecha_respuesta), i.fecha_inicio))) * 1000)::int
                 FROM intentos i LEFT JOIN respuestas_usuario r ON r.intento_id = i.id
                WHERE i.id = %(i)s GROUP BY i.fecha_inicio""",
            {'i': intento_id, 'paso': intento['paso_actual_id'], 'op': opcion['id'], 'clave': opcion['clave'],
             'texto': opcion['texto'], 'tipo': opcion['tipo_accion']},
        )
        actualizado = conn.execute(
            'UPDATE intentos SET paso_actual_id = %s WHERE id = %s RETURNING *',
            (opcion['siguiente_paso_id'], intento_id),
        ).fetchone()

        return {
            'intento': _resumen_intento(actualizado, _contar_respuestas(conn, intento_id)),
            'paso': _paso_publico(conn, opcion['siguiente_paso_id']),
        }


def _actualizar_metricas(conn: Connection, usuario_id: int, subcategoria_id: int, rangos: list[dict]):
    """Recalcula el resumen del usuario en una subcategoría a partir de sus intentos finalizados."""
    m = conn.execute(
        """SELECT count(*)::int AS total, COALESCE(sum(i.aciertos), 0)::int AS aciertos,
                  COALESCE(sum(i.errores), 0)::int AS errores, round(avg(i.puntaje), 2)::float AS promedio,
                  (array_agg(i.puntaje ORDER BY i.fecha_fin DESC))[1]::float AS ultimo
             FROM intentos i JOIN escenarios e ON e.id = i.escenario_id
            WHERE i.usuario_id = %s AND e.subcategoria_id = %s AND i.estado = 'finalizado'""",
        (usuario_id, subcategoria_id),
    ).fetchone()
    rango = clasificar(m['promedio'], rangos) if m['promedio'] is not None else None
    conn.execute(
        """INSERT INTO metricas_usuario
             (usuario_id, subcategoria_id, total_intentos, aciertos, errores, puntaje_promedio, ultimo_puntaje,
              nivel_vulnerabilidad, ultima_actualizacion)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
           ON CONFLICT (usuario_id, subcategoria_id) DO UPDATE SET
             total_intentos = EXCLUDED.total_intentos, aciertos = EXCLUDED.aciertos, errores = EXCLUDED.errores,
             puntaje_promedio = EXCLUDED.puntaje_promedio, ultimo_puntaje = EXCLUDED.ultimo_puntaje,
             nivel_vulnerabilidad = EXCLUDED.nivel_vulnerabilidad, ultima_actualizacion = now()""",
        (usuario_id, subcategoria_id, m['total'], m['aciertos'], m['errores'], m['promedio'], m['ultimo'],
         rango['nivel'] if rango else None),
    )


def finalizar(usuario_id: int, intento_id: int) -> dict:
    """
    Evalúa el intento con el motor de reglas, guarda el resultado y actualiza
    las métricas en una sola transacción. Idempotente: si ya estaba
    finalizado devuelve el resultado guardado.
    """
    with transaction() as conn:
        intento = _bloquear_intento(conn, intento_id, usuario_id)
        if intento['estado'] == 'finalizado':
            total = (intento['resultado'] or {}).get('total_decisiones')
            return {'intento': _resumen_intento(intento, total), 'resultado': intento['resultado']}
        if intento['estado'] != 'en_curso':
            raise AppError.conflict('El intento fue abandonado')
        if intento['paso_actual_id']:
            raise AppError.conflict('El escenario aún tiene decisiones pendientes')

        respuestas = conn.execute(
            """SELECT orden, opcion_clave, texto_opcion, tipo_accion, tiempo_respuesta_ms
                 FROM respuestas_usuario WHERE intento_id = %s ORDER BY orden""",
            (intento_id,),
        ).fetchall()
        if not respuestas:
            raise AppError.conflict('El intento no tiene decisiones registradas')

        escenario = scenarios_repo.obtener_documento(intento['escenario_id'], conn)
        rangos = evaluation_repo.rangos_activos(conn)
        resultado = evaluar(escenario=escenario, respuestas=respuestas, rangos=rangos,
                            reglas_globales=evaluation_repo.reglas_globales(conn))

        nivel = resultado['nivel_vulnerabilidad']
        actualizado = conn.execute(
            """UPDATE intentos SET estado = 'finalizado', fecha_fin = now(),
                      duracion_ms = (EXTRACT(EPOCH FROM (now() - fecha_inicio)) * 1000)::int,
                      puntaje = %s, es_vulnerable = %s, nivel_vulnerabilidad = %s, errores = %s, aciertos = %s,
                      senales_detectadas = %s, senales_totales = %s, resultado = %s, version_rangos = %s
                WHERE id = %s RETURNING *""",
            (resultado['puntaje'], resultado['es_vulnerable'], nivel['nivel'] if nivel else None,
             resultado['errores'], resultado['aciertos'], len(resultado['senales']['detectadas']),
             resultado['senales']['total'], Jsonb(resultado), resultado['version_rangos'], intento_id),
        ).fetchone()
        subcategoria_id = conn.execute(
            'SELECT subcategoria_id FROM escenarios WHERE id = %s', (intento['escenario_id'],)
        ).fetchone()['subcategoria_id']
        _actualizar_metricas(conn, usuario_id, subcategoria_id, rangos)
        predictions.recalcular(conn, usuario_id)  # RN-06

        return {'intento': _resumen_intento(actualizado, len(respuestas)), 'resultado': resultado}


def confirmar_retroalimentacion(usuario_id: int, intento_id: int) -> dict:
    """RN-13: el usuario confirma que revisó la retroalimentación. Idempotente."""
    with transaction() as conn:
        intento = _bloquear_intento(conn, intento_id, usuario_id)
        if intento['estado'] != 'finalizado':
            raise AppError.conflict('El intento aún no tiene retroalimentación')
        actualizado = conn.execute(
            """UPDATE intentos SET retroalimentacion_confirmada_en = COALESCE(retroalimentacion_confirmada_en, now())
                WHERE id = %s RETURNING *""",
            (intento_id,),
        ).fetchone()
        return {'intento': _resumen_intento(actualizado, (intento['resultado'] or {}).get('total_decisiones'))}


def abandonar(usuario_id: int, intento_id: int):
    with transaction() as conn:
        intento = _bloquear_intento(conn, intento_id, usuario_id)
        if intento['estado'] != 'en_curso':
            raise AppError.conflict('El intento ya no está en curso')
        conn.execute("UPDATE intentos SET estado = 'abandonado', fecha_fin = now() WHERE id = %s", (intento_id,))


def obtener(usuario: dict, intento_id: int) -> dict:
    """Estado de un intento: paso actual si está en curso, resultado si terminó."""
    with pool.connection() as conn:
        intento = conn.execute('SELECT * FROM intentos WHERE id = %s', (intento_id,)).fetchone()
        if not intento or (intento['usuario_id'] != usuario['id'] and usuario['rol'] != 'administrador'):
            raise AppError.not_found('Intento no encontrado')
        escenario = scenarios_repo.obtener_resumen(intento['escenario_id'], conn)
        en_curso = intento['estado'] == 'en_curso'
        return {
            'intento': _resumen_intento(intento, _contar_respuestas(conn, intento_id)),
            'escenario': _escenario_publico(escenario, con_descripcion=False),
            'paso': _paso_publico(conn, intento['paso_actual_id']) if en_curso else None,
            'resultado': intento['resultado'] if intento['estado'] == 'finalizado' else None,
        }
