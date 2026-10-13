/**
 * Acceso a datos de escenarios. Las funciones que modifican reciben un
 * `client` de pg para ejecutarse dentro de una transacción.
 */
const { query } = require('../../db/pool');

const SELECT_RESUMEN = `
  SELECT e.id, e.codigo, e.titulo, e.descripcion, e.estado, e.contenido,
         t.clave AS tipo, t.nombre AS tipo_nombre,
         d.clave AS dificultad, d.nombre AS dificultad_nombre, d.valor AS dificultad_valor,
         e.fecha_creacion, e.fecha_actualizacion
    FROM escenarios e
    JOIN tipos_ataque t ON t.id = e.tipo_ataque_id
    JOIN niveles_dificultad d ON d.id = e.dificultad_id`;

/** Genera el siguiente código disponible para el tipo de ataque: PH-001, PH-002… */
async function siguienteCodigo(client, tipoAtaqueId) {
  const { rows } = await client.query(
    `SELECT t.prefijo_codigo AS prefijo,
            COALESCE(MAX(substring(e.codigo FROM '-([0-9]+)$')::int), 0) + 1 AS n
       FROM tipos_ataque t
       LEFT JOIN escenarios e ON e.codigo ~ ('^' || t.prefijo_codigo || '-[0-9]+$')
      WHERE t.id = $1
      GROUP BY t.prefijo_codigo`,
    [tipoAtaqueId]
  );
  return `${rows[0].prefijo}-${String(rows[0].n).padStart(3, '0')}`;
}

async function resolverCatalogos(client, tipoClave, dificultadClave) {
  const { rows } = await client.query(
    `SELECT (SELECT id FROM tipos_ataque WHERE clave = $1) AS tipo_ataque_id,
            (SELECT id FROM niveles_dificultad WHERE clave = $2) AS dificultad_id`,
    [tipoClave, dificultadClave]
  );
  return rows[0];
}

async function listar({ pagina, limite, buscar, tipo, dificultad, estado, soloActivos }) {
  const cond = [];
  const params = [];
  const add = (sql, v) => { params.push(v); cond.push(sql.replace('?', `$${params.length}`)); };
  if (soloActivos) cond.push(`e.estado = 'activo'`);
  else if (estado) add('e.estado = ?', estado);
  else cond.push(`e.estado <> 'eliminado'`);
  if (tipo) add('t.clave = ?', tipo);
  if (dificultad) add('d.clave = ?', dificultad);
  if (buscar) add(`(e.titulo ILIKE ? OR e.codigo ILIKE $${params.length + 1})`, `%${buscar.replace(/[\\%_]/g, '\\$&')}%`);
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const total = (await query(
    `SELECT count(*)::int AS n FROM escenarios e
       JOIN tipos_ataque t ON t.id = e.tipo_ataque_id
       JOIN niveles_dificultad d ON d.id = e.dificultad_id ${where}`, params
  )).rows[0].n;
  params.push(limite, (pagina - 1) * limite);
  const { rows } = await query(
    `${SELECT_RESUMEN} ${where}
      ORDER BY t.id, d.valor, e.codigo
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { datos: rows, total, pagina, limite, paginas: Math.ceil(total / limite) };
}

async function obtenerResumen(id) {
  const { rows } = await query(`${SELECT_RESUMEN} WHERE e.id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Devuelve el escenario completo con la misma forma que el payload de
 * POST/PUT (referencias por clave), más ids y metadatos.
 */
async function obtenerDocumento(id, db = { query }) {
  const { rows: [esc] } = await db.query(
    `${SELECT_RESUMEN.replace('e.contenido,', 'e.contenido, e.retroalimentacion_general, e.creado_por,')} WHERE e.id = $1`,
    [id]
  );
  if (!esc) return null;

  const [senales, pasos, opciones, opSen, reglas, intentos] = await Promise.all([
    db.query('SELECT id, clave, descripcion, explicacion FROM senales_alerta WHERE escenario_id = $1 ORDER BY orden', [id]),
    db.query(
      `SELECT id, clave, titulo, pregunta, es_inicial, contenido FROM escenario_pasos
        WHERE escenario_id = $1 ORDER BY orden`, [id]
    ),
    db.query(
      `SELECT o.id, o.paso_id, o.clave, o.texto, o.tipo_accion, o.puntuacion, o.retroalimentacion, sp.clave AS siguiente_paso
         FROM opciones o
         JOIN escenario_pasos p ON p.id = o.paso_id
         LEFT JOIN escenario_pasos sp ON sp.id = o.siguiente_paso_id
        WHERE p.escenario_id = $1 ORDER BY o.orden`, [id]
    ),
    db.query(
      `SELECT os.opcion_id, s.clave FROM opcion_senal os
         JOIN senales_alerta s ON s.id = os.senal_id
        WHERE s.escenario_id = $1 ORDER BY s.orden`, [id]
    ),
    db.query(
      `SELECT id, tipo_regla, parametros, ajuste_puntuacion, descripcion, retroalimentacion, activa
         FROM reglas_evaluacion WHERE escenario_id = $1 ORDER BY prioridad, id`, [id]
    ),
    db.query(`SELECT count(*)::int AS n FROM intentos WHERE escenario_id = $1`, [id]),
  ]);

  const senalesPorOpcion = new Map();
  for (const r of opSen.rows) {
    if (!senalesPorOpcion.has(r.opcion_id)) senalesPorOpcion.set(r.opcion_id, []);
    senalesPorOpcion.get(r.opcion_id).push(r.clave);
  }

  return {
    ...esc,
    total_intentos: intentos.rows[0].n,
    senales: senales.rows,
    pasos: pasos.rows.map((p) => ({
      ...p,
      opciones: opciones.rows
        .filter((o) => o.paso_id === p.id)
        .map(({ paso_id, ...o }) => ({ ...o, senales: senalesPorOpcion.get(o.id) || [] })), // eslint-disable-line no-unused-vars
    })),
    reglas: reglas.rows,
  };
}

async function crear(client, doc, cat, creadoPor) {
  const codigo = doc.codigo || (await siguienteCodigo(client, cat.tipo_ataque_id));
  const { rows } = await client.query(
    `INSERT INTO escenarios (codigo, titulo, tipo_ataque_id, dificultad_id, descripcion, contenido,
                             retroalimentacion_general, estado, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [codigo, doc.titulo, cat.tipo_ataque_id, cat.dificultad_id, doc.descripcion, doc.contenido || {},
      doc.retroalimentacion_general || null, doc.estado || 'borrador', creadoPor]
  );
  await reemplazarEstructura(client, rows[0].id, doc);
  return rows[0].id;
}

async function actualizarMetadatos(client, id, doc, cat) {
  await client.query(
    `UPDATE escenarios SET titulo = $2, tipo_ataque_id = $3, dificultad_id = $4, descripcion = $5,
            contenido = $6, retroalimentacion_general = $7, estado = $8
      WHERE id = $1`,
    [id, doc.titulo, cat.tipo_ataque_id, cat.dificultad_id, doc.descripcion, doc.contenido || {},
      doc.retroalimentacion_general || null, doc.estado]
  );
}

/**
 * Sincroniza señales, pasos, opciones y reglas con el documento. Los
 * elementos se identifican por `clave`: los que se conservan mantienen su id
 * (y con ello el vínculo con respuestas históricas); los que desaparecen se
 * eliminan (las respuestas conservan su copia de texto y puntuación).
 */
async function reemplazarEstructura(client, escenarioId, doc) {
  const q = (sql, params) => client.query(sql, params);

  // Libera las restricciones UNIQUE de orden y de paso inicial mientras se reordena.
  await q('UPDATE senales_alerta SET orden = -orden WHERE escenario_id = $1 AND orden > 0', [escenarioId]);
  await q('UPDATE escenario_pasos SET orden = -orden, es_inicial = false WHERE escenario_id = $1 AND orden > 0', [escenarioId]);
  await q(
    `UPDATE opciones SET orden = -orden
      WHERE orden > 0 AND paso_id IN (SELECT id FROM escenario_pasos WHERE escenario_id = $1)`, [escenarioId]
  );

  // Señales
  const senalIds = new Map(
    (await q('SELECT clave, id FROM senales_alerta WHERE escenario_id = $1', [escenarioId])).rows.map((r) => [r.clave, r.id])
  );
  for (const [i, s] of (doc.senales || []).entries()) {
    if (senalIds.has(s.clave)) {
      await q('UPDATE senales_alerta SET orden = $2, descripcion = $3, explicacion = $4 WHERE id = $1',
        [senalIds.get(s.clave), i + 1, s.descripcion, s.explicacion]);
    } else {
      const { rows } = await q(
        `INSERT INTO senales_alerta (escenario_id, clave, orden, descripcion, explicacion)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`, [escenarioId, s.clave, i + 1, s.descripcion, s.explicacion]
      );
      senalIds.set(s.clave, rows[0].id);
    }
  }

  // Pasos
  const pasoIds = new Map(
    (await q('SELECT clave, id FROM escenario_pasos WHERE escenario_id = $1', [escenarioId])).rows.map((r) => [r.clave, r.id])
  );
  for (const [i, p] of doc.pasos.entries()) {
    const valores = [i + 1, p.titulo, p.pregunta, p.contenido, Boolean(p.es_inicial)];
    if (pasoIds.has(p.clave)) {
      await q(`UPDATE escenario_pasos SET orden = $2, titulo = $3, pregunta = $4, contenido = $5, es_inicial = $6 WHERE id = $1`,
        [pasoIds.get(p.clave), ...valores]);
    } else {
      const { rows } = await q(
        `INSERT INTO escenario_pasos (escenario_id, clave, orden, titulo, pregunta, contenido, es_inicial)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [escenarioId, p.clave, ...valores]
      );
      pasoIds.set(p.clave, rows[0].id);
    }
  }

  // Opciones (una opción puede cambiar de paso; su clave es única en el escenario)
  const opcionIds = new Map((await q(
    `SELECT o.clave, o.id FROM opciones o JOIN escenario_pasos p ON p.id = o.paso_id WHERE p.escenario_id = $1`,
    [escenarioId]
  )).rows.map((r) => [r.clave, r.id]));
  const clavesOpcion = [];
  const senalesDeOpcion = [];
  for (const p of doc.pasos) {
    for (const [i, o] of p.opciones.entries()) {
      const valores = [
        pasoIds.get(p.clave), i + 1, o.texto, o.tipo_accion, o.puntuacion, o.retroalimentacion,
        o.siguiente_paso == null ? null : pasoIds.get(o.siguiente_paso),
      ];
      let id = opcionIds.get(o.clave);
      if (id) {
        await q(`UPDATE opciones SET paso_id = $2, orden = $3, texto = $4, tipo_accion = $5, puntuacion = $6,
                        retroalimentacion = $7, siguiente_paso_id = $8 WHERE id = $1`, [id, ...valores]);
      } else {
        const { rows } = await q(
          `INSERT INTO opciones (paso_id, orden, texto, tipo_accion, puntuacion, retroalimentacion, siguiente_paso_id, clave)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, [...valores, o.clave]
        );
        id = rows[0].id;
      }
      clavesOpcion.push(o.clave);
      for (const s of o.senales || []) senalesDeOpcion.push([id, senalIds.get(s)]);
    }
  }

  // Eliminar lo que ya no está en el documento
  await q(
    `DELETE FROM opciones o USING escenario_pasos p
      WHERE p.id = o.paso_id AND p.escenario_id = $1 AND NOT (o.clave = ANY($2::text[]))`,
    [escenarioId, clavesOpcion]
  );
  await q('DELETE FROM escenario_pasos WHERE escenario_id = $1 AND NOT (clave = ANY($2::text[]))',
    [escenarioId, doc.pasos.map((p) => p.clave)]);
  await q('DELETE FROM senales_alerta WHERE escenario_id = $1 AND NOT (clave = ANY($2::text[]))',
    [escenarioId, (doc.senales || []).map((s) => s.clave)]);

  // Relación opción–señal
  await q(
    `DELETE FROM opcion_senal os USING senales_alerta s WHERE s.id = os.senal_id AND s.escenario_id = $1`, [escenarioId]
  );
  for (const [opcionId, senalId] of senalesDeOpcion) {
    await q('INSERT INTO opcion_senal (opcion_id, senal_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [opcionId, senalId]);
  }

  // Reglas: no tienen referencias históricas, se reemplazan completas.
  await q('DELETE FROM reglas_evaluacion WHERE escenario_id = $1', [escenarioId]);
  for (const [i, r] of (doc.reglas || []).entries()) {
    await q(
      `INSERT INTO reglas_evaluacion
         (escenario_id, tipo_regla, parametros, ajuste_puntuacion, descripcion, retroalimentacion, activa, prioridad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [escenarioId, r.tipo_regla, r.parametros || {}, r.ajuste_puntuacion || 0, r.descripcion,
        r.retroalimentacion || null, r.activa ?? true, i + 1]
    );
  }
}

async function cambiarEstado(id, estado) {
  const { rows } = await query('UPDATE escenarios SET estado = $2 WHERE id = $1 RETURNING id', [id, estado]);
  return rows.length > 0;
}

async function catalogos() {
  const [tipos, dificultades] = await Promise.all([
    query('SELECT clave, nombre, prefijo_codigo, descripcion FROM tipos_ataque ORDER BY id'),
    query('SELECT clave, nombre, valor FROM niveles_dificultad ORDER BY valor'),
  ]);
  return { tipos_ataque: tipos.rows, dificultades: dificultades.rows };
}

module.exports = {
  siguienteCodigo, resolverCatalogos, listar, obtenerResumen, obtenerDocumento,
  crear, actualizarMetadatos, reemplazarEstructura, cambiarEstado, catalogos,
};
