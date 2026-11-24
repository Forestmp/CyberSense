"""
Examen diagnóstico (RF-22, RN-22): una pregunta por subcategoría, una sola vez
por usuario. Al responder la última pregunta el examen se finaliza y se
calculan las primeras predicciones de error del usuario (RN-06, RN-07).
"""
from psycopg import Connection

from app.db import pool, transaction
from app.errors import AppError
from app.modules import predictions


def _examen(conn: Connection, usuario_id: int, bloquear: bool = False) -> dict | None:
    return conn.execute(
        f"""SELECT id, estado, fecha_inicio, fecha_fin FROM examenes_diagnostico
             WHERE usuario_id = %s {'FOR UPDATE' if bloquear else ''}""",
        (usuario_id,),
    ).fetchone()


def _pendientes(conn: Connection, examen_id: int) -> list[dict]:
    """Preguntas activas que el usuario aún no responde, en orden."""
    return conn.execute(
        """SELECT p.id, p.orden, p.enunciado, p.contenido
             FROM preguntas_diagnostico p
            WHERE p.activa
              AND NOT EXISTS (SELECT 1 FROM respuestas_diagnostico r
                               WHERE r.examen_id = %s AND r.pregunta_id = p.id)
            ORDER BY p.orden""",
        (examen_id,),
    ).fetchall()


def _total(conn: Connection) -> int:
    return conn.execute('SELECT count(*)::int AS n FROM preguntas_diagnostico WHERE activa').fetchone()['n']


def _pregunta_publica(conn: Connection, p: dict) -> dict:
    """Pregunta tal como la ve el usuario: sin puntuaciones ni señales de alerta."""
    contenido = {k: v for k, v in (p['contenido'] or {}).items() if k != 'senales'}
    opciones = conn.execute(
        'SELECT id, texto FROM opciones_diagnostico WHERE pregunta_id = %s ORDER BY orden', (p['id'],)
    ).fetchall()
    return {'id': p['id'], 'orden': p['orden'], 'enunciado': p['enunciado'], 'contenido': contenido,
            'opciones': opciones}


def _resultado(conn: Connection, examen_id: int) -> dict:
    """Puntaje por subcategoría con la opción elegida, la más segura y las señales de alerta."""
    filas = conn.execute(
        """SELECT p.orden, sc.clave AS subcategoria, sc.nombre AS subcategoria_nombre, t.clave AS tipo,
                  p.contenido, o.texto AS opcion_elegida, o.puntuacion,
                  (SELECT os.texto FROM opciones_diagnostico os WHERE os.pregunta_id = p.id
                    ORDER BY os.puntuacion DESC, os.orden LIMIT 1) AS opcion_segura
             FROM respuestas_diagnostico r
             JOIN preguntas_diagnostico p ON p.id = r.pregunta_id
             JOIN opciones_diagnostico o ON o.id = r.opcion_id
             JOIN subcategorias sc ON sc.id = p.subcategoria_id
             JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
            WHERE r.examen_id = %s
            ORDER BY p.orden""",
        (examen_id,),
    ).fetchall()
    respuestas = [{
        'orden': f['orden'], 'subcategoria': f['subcategoria'], 'subcategoria_nombre': f['subcategoria_nombre'],
        'tipo': f['tipo'], 'puntuacion': f['puntuacion'], 'opcion_elegida': f['opcion_elegida'],
        'opcion_segura': f['opcion_segura'], 'senales': (f['contenido'] or {}).get('senales', []),
    } for f in filas]
    promedio = round(sum(r['puntuacion'] for r in respuestas) / len(respuestas) * 100, 2) if respuestas else None
    return {'puntaje': promedio, 'respuestas': respuestas}


def _estado(conn: Connection, usuario_id: int) -> dict:
    examen = _examen(conn, usuario_id)
    if not examen:
        return {'examen': None, 'pregunta': None, 'resultado': None}
    total = _total(conn)
    if examen['estado'] == 'finalizado':
        return {'examen': {**examen, 'respondidas': total, 'total': total}, 'pregunta': None,
                'resultado': _resultado(conn, examen['id'])}
    pendientes = _pendientes(conn, examen['id'])
    return {
        'examen': {**examen, 'respondidas': total - len(pendientes), 'total': total},
        'pregunta': _pregunta_publica(conn, pendientes[0]) if pendientes else None,
        'resultado': None,
    }


def obtener(usuario_id: int) -> dict:
    with pool.connection() as conn:
        return _estado(conn, usuario_id)


def iniciar(usuario_id: int) -> dict:
    """Crea el examen; si ya hay uno en curso lo devuelve para continuarlo. RN-22: solo una vez."""
    with transaction() as conn:
        if _total(conn) == 0:
            raise AppError.conflict('El examen diagnóstico aún no tiene preguntas')
        conn.execute('SELECT pg_advisory_xact_lock(%s::bigint)', (usuario_id,))
        examen = _examen(conn, usuario_id)
        if examen and examen['estado'] == 'finalizado':
            raise AppError.conflict('Ya presentaste el examen diagnóstico; solo se presenta una vez')
        if not examen:
            conn.execute('INSERT INTO examenes_diagnostico (usuario_id) VALUES (%s)', (usuario_id,))
        return _estado(conn, usuario_id)


def _finalizar(conn: Connection, usuario_id: int, examen_id: int):
    conn.execute(
        "UPDATE examenes_diagnostico SET estado = 'finalizado', fecha_fin = now() WHERE id = %s", (examen_id,)
    )
    # El diagnóstico es la primera evaluación del usuario (RN-07): la puntuación
    # de cada respuesta es su puntaje inicial en la subcategoría.
    predictions.recalcular(conn, usuario_id)


def responder(usuario_id: int, opcion_id: int) -> dict:
    """Registra la respuesta a la pregunta actual; al responder la última, finaliza el examen."""
    with transaction() as conn:
        examen = _examen(conn, usuario_id, bloquear=True)
        if not examen:
            raise AppError.conflict('Primero inicia el examen diagnóstico')
        if examen['estado'] == 'finalizado':
            raise AppError.conflict('El examen diagnóstico ya terminó')
        pendientes = _pendientes(conn, examen['id'])
        if not pendientes:
            raise AppError.conflict('No hay preguntas pendientes')
        actual = pendientes[0]
        opcion = conn.execute(
            'SELECT id FROM opciones_diagnostico WHERE id = %s AND pregunta_id = %s', (opcion_id, actual['id'])
        ).fetchone()
        if not opcion:
            raise AppError.bad_request('La opción no corresponde a la pregunta actual')
        conn.execute(
            'INSERT INTO respuestas_diagnostico (examen_id, pregunta_id, opcion_id) VALUES (%s, %s, %s)',
            (examen['id'], actual['id'], opcion_id),
        )
        if len(pendientes) == 1:
            _finalizar(conn, usuario_id, examen['id'])
        return _estado(conn, usuario_id)
