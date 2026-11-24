"""
Acceso a datos de escenarios. Las funciones que modifican reciben una
conexión para ejecutarse dentro de una transacción.
"""
from psycopg import Connection
from psycopg.types.json import Jsonb

from app.db import pool, query, query_one
from app.schemas import escapar_like, paginado

SELECT_RESUMEN = """
  SELECT e.id, e.codigo, e.titulo, e.descripcion, e.estado, e.contenido,
         t.clave AS tipo, t.nombre AS tipo_nombre,
         sc.clave AS subcategoria, sc.nombre AS subcategoria_nombre,
         d.clave AS dificultad, d.nombre AS dificultad_nombre, d.valor AS dificultad_valor,
         e.fecha_creacion, e.fecha_actualizacion
    FROM escenarios e
    JOIN subcategorias sc ON sc.id = e.subcategoria_id
    JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
    JOIN niveles_dificultad d ON d.id = e.dificultad_id"""


def siguiente_codigo(conn: Connection, subcategoria_id: int) -> str:
    """Genera el siguiente código con el prefijo del tipo de ataque de la subcategoría: PH-001, PH-002…"""
    fila = conn.execute(
        """SELECT t.prefijo_codigo AS prefijo,
                  COALESCE(MAX(substring(e.codigo FROM '-([0-9]+)$')::int), 0) + 1 AS n
             FROM subcategorias sc
             JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
             LEFT JOIN escenarios e ON e.codigo ~ ('^' || t.prefijo_codigo || '-[0-9]+$')
            WHERE sc.id = %s
            GROUP BY t.prefijo_codigo""",
        (subcategoria_id,),
    ).fetchone()
    return f"{fila['prefijo']}-{fila['n']:03d}"


def resolver_catalogos(conn: Connection, subcategoria_clave: str, dificultad_clave: str) -> dict:
    return conn.execute(
        """SELECT (SELECT id FROM subcategorias WHERE clave = %s) AS subcategoria_id,
                  (SELECT id FROM niveles_dificultad WHERE clave = %s) AS dificultad_id""",
        (subcategoria_clave, dificultad_clave),
    ).fetchone()


def listar(pagina: int, limite: int, buscar: str | None, tipo: str | None, subcategoria: str | None,
           dificultad: str | None, estado: str | None, solo_activos: bool) -> dict:
    cond, params = [], []
    if solo_activos:
        cond.append("e.estado = 'activo'")
    elif estado:
        cond.append('e.estado = %s')
        params.append(estado)
    else:
        cond.append("e.estado <> 'eliminado'")
    if tipo:
        cond.append('t.clave = %s')
        params.append(tipo)
    if subcategoria:
        cond.append('sc.clave = %s')
        params.append(subcategoria)
    if dificultad:
        cond.append('d.clave = %s')
        params.append(dificultad)
    if buscar:
        patron = f'%{escapar_like(buscar)}%'
        cond.append('(e.titulo ILIKE %s OR e.codigo ILIKE %s)')
        params += [patron, patron]
    where = f'WHERE {" AND ".join(cond)}' if cond else ''

    total = query_one(
        f"""SELECT count(*)::int AS n FROM escenarios e
              JOIN subcategorias sc ON sc.id = e.subcategoria_id
              JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id
              JOIN niveles_dificultad d ON d.id = e.dificultad_id {where}""",
        params,
    )['n']
    filas = query(
        f"""{SELECT_RESUMEN} {where}
             ORDER BY t.id, sc.id, d.valor, e.codigo
             LIMIT %s OFFSET %s""",
        [*params, limite, (pagina - 1) * limite],
    )
    return paginado(filas, total, pagina, limite)


def obtener_resumen(id_: int, conn: Connection | None = None) -> dict | None:
    sql = f'{SELECT_RESUMEN} WHERE e.id = %s'
    if conn:
        return conn.execute(sql, (id_,)).fetchone()
    return query_one(sql, (id_,))


def obtener_documento(id_: int, conn: Connection | None = None) -> dict | None:
    """
    Devuelve el escenario completo con la misma forma que el payload de
    POST/PUT (referencias por clave), más ids y metadatos.
    """
    if conn is None:
        with pool.connection() as c:
            return obtener_documento(id_, c)

    def q(sql, params=(id_,)):
        return conn.execute(sql, params).fetchall()

    esc = q(SELECT_RESUMEN.replace('e.contenido,', 'e.contenido, e.retroalimentacion_general, e.creado_por,')
            + ' WHERE e.id = %s')
    if not esc:
        return None
    esc = esc[0]

    senales = q('SELECT id, clave, descripcion, explicacion FROM senales_alerta WHERE escenario_id = %s ORDER BY orden')
    pasos = q("""SELECT id, clave, titulo, pregunta, es_inicial, contenido FROM escenario_pasos
                  WHERE escenario_id = %s ORDER BY orden""")
    opciones = q("""SELECT o.id, o.paso_id, o.clave, o.texto, o.tipo_accion, o.puntuacion, o.retroalimentacion,
                           sp.clave AS siguiente_paso
                      FROM opciones o
                      JOIN escenario_pasos p ON p.id = o.paso_id
                      LEFT JOIN escenario_pasos sp ON sp.id = o.siguiente_paso_id
                     WHERE p.escenario_id = %s ORDER BY o.orden""")
    op_sen = q("""SELECT os.opcion_id, s.clave FROM opcion_senal os
                    JOIN senales_alerta s ON s.id = os.senal_id
                   WHERE s.escenario_id = %s ORDER BY s.orden""")
    reglas = q("""SELECT id, tipo_regla, parametros, ajuste_puntuacion, descripcion, retroalimentacion, activa
                    FROM reglas_evaluacion WHERE escenario_id = %s ORDER BY prioridad, id""")
    intentos = q('SELECT count(*)::int AS n FROM intentos WHERE escenario_id = %s')[0]['n']

    senales_por_opcion: dict[int, list[str]] = {}
    for r in op_sen:
        senales_por_opcion.setdefault(r['opcion_id'], []).append(r['clave'])

    return {
        **esc,
        'total_intentos': intentos,
        'senales': senales,
        'pasos': [
            {
                **p,
                'opciones': [
                    {**{k: v for k, v in o.items() if k != 'paso_id'}, 'senales': senales_por_opcion.get(o['id'], [])}
                    for o in opciones if o['paso_id'] == p['id']
                ],
            }
            for p in pasos
        ],
        'reglas': reglas,
    }


def crear(conn: Connection, doc: dict, cat: dict, creado_por: int | None) -> int:
    codigo = doc.get('codigo') or siguiente_codigo(conn, cat['subcategoria_id'])
    fila = conn.execute(
        """INSERT INTO escenarios (codigo, titulo, subcategoria_id, dificultad_id, descripcion, contenido,
                                   retroalimentacion_general, estado, creado_por)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        (codigo, doc['titulo'], cat['subcategoria_id'], cat['dificultad_id'], doc['descripcion'],
         Jsonb(doc.get('contenido') or {}), doc.get('retroalimentacion_general') or None,
         doc.get('estado') or 'borrador', creado_por),
    ).fetchone()
    reemplazar_estructura(conn, fila['id'], doc)
    return fila['id']


def actualizar_metadatos(conn: Connection, id_: int, doc: dict, cat: dict):
    conn.execute(
        """UPDATE escenarios SET titulo = %s, subcategoria_id = %s, dificultad_id = %s, descripcion = %s,
                  contenido = %s, retroalimentacion_general = %s, estado = %s
            WHERE id = %s""",
        (doc['titulo'], cat['subcategoria_id'], cat['dificultad_id'], doc['descripcion'],
         Jsonb(doc.get('contenido') or {}), doc.get('retroalimentacion_general') or None, doc['estado'], id_),
    )


def reemplazar_estructura(conn: Connection, escenario_id: int, doc: dict):
    """
    Sincroniza señales, pasos, opciones y reglas con el documento. Los
    elementos se identifican por `clave`: los que se conservan mantienen su id
    (y con ello el vínculo con respuestas históricas); los que desaparecen se
    eliminan (las respuestas conservan su copia de texto y puntuación).
    """
    def q(sql, params):
        return conn.execute(sql, params)

    # Libera las restricciones UNIQUE de orden y de paso inicial mientras se reordena.
    q('UPDATE senales_alerta SET orden = -orden WHERE escenario_id = %s AND orden > 0', (escenario_id,))
    q('UPDATE escenario_pasos SET orden = -orden, es_inicial = false WHERE escenario_id = %s AND orden > 0',
      (escenario_id,))
    q("""UPDATE opciones SET orden = -orden
          WHERE orden > 0 AND paso_id IN (SELECT id FROM escenario_pasos WHERE escenario_id = %s)""",
      (escenario_id,))

    # Señales
    senal_ids = {r['clave']: r['id'] for r in
                 q('SELECT clave, id FROM senales_alerta WHERE escenario_id = %s', (escenario_id,)).fetchall()}
    for i, s in enumerate(doc.get('senales') or [], start=1):
        if s['clave'] in senal_ids:
            q('UPDATE senales_alerta SET orden = %s, descripcion = %s, explicacion = %s WHERE id = %s',
              (i, s['descripcion'], s['explicacion'], senal_ids[s['clave']]))
        else:
            senal_ids[s['clave']] = q(
                """INSERT INTO senales_alerta (escenario_id, clave, orden, descripcion, explicacion)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                (escenario_id, s['clave'], i, s['descripcion'], s['explicacion']),
            ).fetchone()['id']

    # Pasos
    paso_ids = {r['clave']: r['id'] for r in
                q('SELECT clave, id FROM escenario_pasos WHERE escenario_id = %s', (escenario_id,)).fetchall()}
    for i, p in enumerate(doc['pasos'], start=1):
        valores = (i, p['titulo'], p['pregunta'], Jsonb(p['contenido']), bool(p.get('es_inicial')))
        if p['clave'] in paso_ids:
            q("""UPDATE escenario_pasos SET orden = %s, titulo = %s, pregunta = %s, contenido = %s, es_inicial = %s
                  WHERE id = %s""", (*valores, paso_ids[p['clave']]))
        else:
            paso_ids[p['clave']] = q(
                """INSERT INTO escenario_pasos (orden, titulo, pregunta, contenido, es_inicial, escenario_id, clave)
                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (*valores, escenario_id, p['clave']),
            ).fetchone()['id']

    # Opciones (una opción puede cambiar de paso; su clave es única en el escenario)
    opcion_ids = {r['clave']: r['id'] for r in q(
        """SELECT o.clave, o.id FROM opciones o JOIN escenario_pasos p ON p.id = o.paso_id
            WHERE p.escenario_id = %s""", (escenario_id,)).fetchall()}
    claves_opcion: list[str] = []
    senales_de_opcion: list[tuple[int, int]] = []
    for p in doc['pasos']:
        for i, o in enumerate(p['opciones'], start=1):
            sig = o.get('siguiente_paso')
            valores = (paso_ids[p['clave']], i, o['texto'], o['tipo_accion'], o['puntuacion'],
                       o['retroalimentacion'], paso_ids[sig] if sig is not None else None)
            id_ = opcion_ids.get(o['clave'])
            if id_:
                q("""UPDATE opciones SET paso_id = %s, orden = %s, texto = %s, tipo_accion = %s, puntuacion = %s,
                            retroalimentacion = %s, siguiente_paso_id = %s WHERE id = %s""", (*valores, id_))
            else:
                id_ = q(
                    """INSERT INTO opciones (paso_id, orden, texto, tipo_accion, puntuacion, retroalimentacion,
                                             siguiente_paso_id, clave)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (*valores, o['clave']),
                ).fetchone()['id']
            claves_opcion.append(o['clave'])
            senales_de_opcion += [(id_, senal_ids[s]) for s in o.get('senales') or []]

    # Eliminar lo que ya no está en el documento
    q("""DELETE FROM opciones o USING escenario_pasos p
          WHERE p.id = o.paso_id AND p.escenario_id = %s AND NOT (o.clave = ANY(%s::text[]))""",
      (escenario_id, claves_opcion))
    q('DELETE FROM escenario_pasos WHERE escenario_id = %s AND NOT (clave = ANY(%s::text[]))',
      (escenario_id, [p['clave'] for p in doc['pasos']]))
    q('DELETE FROM senales_alerta WHERE escenario_id = %s AND NOT (clave = ANY(%s::text[]))',
      (escenario_id, [s['clave'] for s in doc.get('senales') or []]))

    # Relación opción–señal
    q('DELETE FROM opcion_senal os USING senales_alerta s WHERE s.id = os.senal_id AND s.escenario_id = %s',
      (escenario_id,))
    for opcion_id, senal_id in senales_de_opcion:
        q('INSERT INTO opcion_senal (opcion_id, senal_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
          (opcion_id, senal_id))

    # Reglas: no tienen referencias históricas, se reemplazan completas.
    q('DELETE FROM reglas_evaluacion WHERE escenario_id = %s', (escenario_id,))
    for i, r in enumerate(doc.get('reglas') or [], start=1):
        q("""INSERT INTO reglas_evaluacion
               (escenario_id, tipo_regla, parametros, ajuste_puntuacion, descripcion, retroalimentacion, activa, prioridad)
             VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
          (escenario_id, r['tipo_regla'], Jsonb(r.get('parametros') or {}), r.get('ajuste_puntuacion') or 0,
           r['descripcion'], r.get('retroalimentacion') or None, r.get('activa', True), i))


def cambiar_estado(id_: int, estado: str) -> bool:
    return bool(query('UPDATE escenarios SET estado = %s WHERE id = %s RETURNING id', (estado, id_)))


def catalogos() -> dict:
    return {
        'tipos_ataque': query('SELECT clave, nombre, prefijo_codigo, descripcion FROM tipos_ataque ORDER BY id'),
        'subcategorias': query(
            """SELECT sc.clave, sc.nombre, sc.descripcion, t.clave AS tipo
                 FROM subcategorias sc JOIN tipos_ataque t ON t.id = sc.tipo_ataque_id ORDER BY sc.id"""),
        'dificultades': query('SELECT clave, nombre, valor FROM niveles_dificultad ORDER BY valor'),
    }
