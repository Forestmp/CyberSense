/**
 * Acceso a datos de escenarios. Las funciones reciben un `client` de pg para
 * poder ejecutarse dentro de una transacción.
 */

/** Genera el siguiente código disponible para el tipo de ataque: PH-001, PH-002… */
async function siguienteCodigo(client, tipoAtaqueId) {
  const { rows } = await client.query(
    `SELECT t.prefijo_codigo AS prefijo,
            COALESCE(MAX(NULLIF(regexp_replace(e.codigo, '^[A-Z]+-', ''), '')::int), 0) + 1 AS n
       FROM tipos_ataque t
       LEFT JOIN escenarios e ON e.tipo_ataque_id = t.id AND e.codigo ~ ('^' || t.prefijo_codigo || '-[0-9]+$')
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

/**
 * Inserta señales, pasos, opciones y reglas de un escenario a partir del
 * documento (referencias por clave). Se asume que el escenario no tiene aún
 * estructura (recién creado o vaciado con borrarEstructura).
 */
async function insertarEstructura(client, escenarioId, doc) {
  const senalIds = new Map();
  for (const [i, s] of (doc.senales || []).entries()) {
    const { rows } = await client.query(
      `INSERT INTO senales_alerta (escenario_id, clave, orden, descripcion, explicacion)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [escenarioId, s.clave, i + 1, s.descripcion, s.explicacion]
    );
    senalIds.set(s.clave, rows[0].id);
  }

  const pasoIds = new Map();
  for (const [i, p] of doc.pasos.entries()) {
    const { rows } = await client.query(
      `INSERT INTO escenario_pasos (escenario_id, clave, orden, titulo, pregunta, contenido, es_inicial)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [escenarioId, p.clave, i + 1, p.titulo, p.pregunta, p.contenido, Boolean(p.es_inicial)]
    );
    pasoIds.set(p.clave, rows[0].id);
  }

  for (const p of doc.pasos) {
    for (const [i, o] of p.opciones.entries()) {
      const { rows } = await client.query(
        `INSERT INTO opciones (paso_id, clave, orden, texto, tipo_accion, puntuacion, retroalimentacion, siguiente_paso_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          pasoIds.get(p.clave), o.clave, i + 1, o.texto, o.tipo_accion, o.puntuacion,
          o.retroalimentacion, o.siguiente_paso == null ? null : pasoIds.get(o.siguiente_paso),
        ]
      );
      for (const s of o.senales || []) {
        await client.query('INSERT INTO opcion_senal (opcion_id, senal_id) VALUES ($1, $2)', [rows[0].id, senalIds.get(s)]);
      }
    }
  }

  for (const [i, r] of (doc.reglas || []).entries()) {
    await client.query(
      `INSERT INTO reglas_evaluacion
         (escenario_id, tipo_regla, parametros, ajuste_puntuacion, descripcion, retroalimentacion, activa, prioridad)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [escenarioId, r.tipo_regla, r.parametros || {}, r.ajuste_puntuacion || 0, r.descripcion,
        r.retroalimentacion || null, r.activa ?? true, i + 1]
    );
  }
}

module.exports = { siguienteCodigo, resolverCatalogos, insertarEstructura };
