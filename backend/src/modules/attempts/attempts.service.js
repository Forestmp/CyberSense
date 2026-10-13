const { query, withTransaction } = require('../../db/pool');
const AppError = require('../../utils/AppError');
const scenariosRepo = require('../scenarios/scenarios.repository');
const evaluationRepo = require('../evaluation/evaluation.repository');
const { evaluar, clasificar } = require('../evaluation/engine');

/**
 * Paso tal como lo ve el usuario: contenido simulado, pregunta y textos de
 * las opciones. Nunca incluye tipo de acción, puntuación ni retroalimentación.
 */
async function pasoPublico(db, pasoId) {
  if (!pasoId) return null;
  const { rows: [paso] } = await db.query(
    'SELECT id, titulo, pregunta, contenido FROM escenario_pasos WHERE id = $1', [pasoId]
  );
  if (!paso) return null;
  const { rows: opciones } = await db.query('SELECT id, texto FROM opciones WHERE paso_id = $1 ORDER BY orden', [pasoId]);
  return { ...paso, opciones };
}

async function bloquearIntento(client, intentoId, usuarioId) {
  const { rows: [intento] } = await client.query('SELECT * FROM intentos WHERE id = $1 FOR UPDATE', [intentoId]);
  if (!intento || intento.usuario_id !== usuarioId) throw AppError.notFound('Intento no encontrado');
  return intento;
}

const resumenIntento = (i, decisiones) => ({
  id: i.id,
  escenario_id: i.escenario_id,
  numero_intento: i.numero_intento,
  estado: i.estado,
  fecha_inicio: i.fecha_inicio,
  fecha_fin: i.fecha_fin,
  decisiones_tomadas: decisiones,
  terminado: i.estado === 'en_curso' ? i.paso_actual_id === null : i.estado === 'finalizado',
});

async function contarRespuestas(db, intentoId) {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM respuestas_usuario WHERE intento_id = $1', [intentoId]);
  return rows[0].n;
}

/** Inicia un intento. Si el usuario tenía uno en curso del mismo escenario, se abandona. */
async function iniciar(usuarioId, escenarioId) {
  return withTransaction(async (client) => {
    const escenario = await scenariosRepo.obtenerResumen(escenarioId);
    if (!escenario || escenario.estado !== 'activo') throw AppError.notFound('Escenario no disponible');

    const { rows: [inicial] } = await client.query(
      'SELECT id FROM escenario_pasos WHERE escenario_id = $1 AND es_inicial', [escenarioId]
    );
    if (!inicial) throw AppError.conflict('El escenario no tiene paso inicial');

    await client.query(
      `UPDATE intentos SET estado = 'abandonado', fecha_fin = now()
        WHERE usuario_id = $1 AND escenario_id = $2 AND estado = 'en_curso'`, [usuarioId, escenarioId]
    );
    // Bloqueo por usuario+escenario para que dos peticiones simultáneas no choquen en numero_intento.
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [usuarioId, escenarioId]);
    const { rows: [intento] } = await client.query(
      `INSERT INTO intentos (usuario_id, escenario_id, numero_intento, paso_actual_id)
       VALUES ($1, $2, (SELECT count(*) + 1 FROM intentos WHERE usuario_id = $1 AND escenario_id = $2), $3)
       RETURNING *`,
      [usuarioId, escenarioId, inicial.id]
    );

    return {
      intento: resumenIntento(intento, 0),
      escenario: {
        id: escenario.id, codigo: escenario.codigo, titulo: escenario.titulo, descripcion: escenario.descripcion,
        tipo: escenario.tipo, tipo_nombre: escenario.tipo_nombre, dificultad: escenario.dificultad,
        dificultad_nombre: escenario.dificultad_nombre, contexto: escenario.contenido?.contexto ?? null,
      },
      paso: await pasoPublico(client, inicial.id),
    };
  });
}

/**
 * Registra una decisión. No revela si fue correcta: solo devuelve el
 * siguiente paso o indica que el escenario terminó.
 */
async function responder(usuarioId, intentoId, opcionId) {
  return withTransaction(async (client) => {
    const intento = await bloquearIntento(client, intentoId, usuarioId);
    if (intento.estado !== 'en_curso') throw AppError.conflict('El intento ya no está en curso');
    if (!intento.paso_actual_id) throw AppError.conflict('No hay decisiones pendientes; finaliza el intento');

    const { rows: [opcion] } = await client.query(
      'SELECT id, clave, texto, tipo_accion, puntuacion, siguiente_paso_id FROM opciones WHERE id = $1 AND paso_id = $2',
      [opcionId, intento.paso_actual_id]
    );
    if (!opcion) throw AppError.badRequest('La opción no corresponde al paso actual');

    // Tiempo de respuesta medido en el servidor desde la decisión anterior (o el inicio).
    await client.query(
      `INSERT INTO respuestas_usuario
         (intento_id, paso_id, opcion_id, orden, opcion_clave, texto_opcion, tipo_accion, puntuacion, tiempo_respuesta_ms)
       SELECT $1, $2, $3, count(r.id) + 1, $4, $5, $6, $7,
              (EXTRACT(EPOCH FROM (now() - COALESCE(max(r.fecha_respuesta), i.fecha_inicio))) * 1000)::int
         FROM intentos i LEFT JOIN respuestas_usuario r ON r.intento_id = i.id
        WHERE i.id = $1 GROUP BY i.fecha_inicio`,
      [intentoId, intento.paso_actual_id, opcion.id, opcion.clave, opcion.texto, opcion.tipo_accion, opcion.puntuacion]
    );
    const { rows: [actualizado] } = await client.query(
      'UPDATE intentos SET paso_actual_id = $2 WHERE id = $1 RETURNING *', [intentoId, opcion.siguiente_paso_id]
    );

    return {
      intento: resumenIntento(actualizado, await contarRespuestas(client, intentoId)),
      paso: await pasoPublico(client, opcion.siguiente_paso_id),
    };
  });
}

/** Recalcula el resumen del usuario para un tipo de ataque a partir de sus intentos finalizados. */
async function actualizarMetricas(client, usuarioId, tipoAtaqueId, rangos) {
  const { rows: [m] } = await client.query(
    `SELECT count(*)::int AS total, COALESCE(sum(i.aciertos), 0)::int AS aciertos,
            COALESCE(sum(i.errores), 0)::int AS errores, round(avg(i.puntaje), 2)::float AS promedio,
            (array_agg(i.puntaje ORDER BY i.fecha_fin DESC))[1]::float AS ultimo
       FROM intentos i JOIN escenarios e ON e.id = i.escenario_id
      WHERE i.usuario_id = $1 AND e.tipo_ataque_id = $2 AND i.estado = 'finalizado'`,
    [usuarioId, tipoAtaqueId]
  );
  const nivel = m.promedio == null ? null : clasificar(m.promedio, rangos)?.nivel ?? null;
  await client.query(
    `INSERT INTO metricas_usuario
       (usuario_id, tipo_ataque_id, total_intentos, aciertos, errores, puntaje_promedio, ultimo_puntaje, nivel_vulnerabilidad, ultima_actualizacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (usuario_id, tipo_ataque_id) DO UPDATE SET
       total_intentos = EXCLUDED.total_intentos, aciertos = EXCLUDED.aciertos, errores = EXCLUDED.errores,
       puntaje_promedio = EXCLUDED.puntaje_promedio, ultimo_puntaje = EXCLUDED.ultimo_puntaje,
       nivel_vulnerabilidad = EXCLUDED.nivel_vulnerabilidad, ultima_actualizacion = now()`,
    [usuarioId, tipoAtaqueId, m.total, m.aciertos, m.errores, m.promedio, m.ultimo, nivel]
  );
}

/**
 * Evalúa el intento con el motor de reglas, guarda el resultado y actualiza
 * las métricas en una sola transacción. Idempotente: si ya estaba
 * finalizado devuelve el resultado guardado.
 */
async function finalizar(usuarioId, intentoId) {
  return withTransaction(async (client) => {
    const intento = await bloquearIntento(client, intentoId, usuarioId);
    if (intento.estado === 'finalizado') return { intento: resumenIntento(intento, intento.resultado?.total_decisiones), resultado: intento.resultado };
    if (intento.estado !== 'en_curso') throw AppError.conflict('El intento fue abandonado');
    if (intento.paso_actual_id) throw AppError.conflict('El escenario aún tiene decisiones pendientes');

    const { rows: respuestas } = await client.query(
      `SELECT orden, opcion_clave, texto_opcion, tipo_accion, puntuacion, tiempo_respuesta_ms
         FROM respuestas_usuario WHERE intento_id = $1 ORDER BY orden`, [intentoId]
    );
    if (!respuestas.length) throw AppError.conflict('El intento no tiene decisiones registradas');

    const escenario = await scenariosRepo.obtenerDocumento(intento.escenario_id, client);
    const rangos = await evaluationRepo.rangosActivos(client);
    const resultado = evaluar({ escenario, reglasGlobales: await evaluationRepo.reglasGlobales(client), respuestas, rangos });

    const { rows: [actualizado] } = await client.query(
      `UPDATE intentos SET estado = 'finalizado', fecha_fin = now(),
              duracion_ms = (EXTRACT(EPOCH FROM (now() - fecha_inicio)) * 1000)::int,
              puntaje_bruto = $2, puntaje = $3, nivel_vulnerabilidad = $4, errores = $5, aciertos = $6,
              senales_detectadas = $7, senales_totales = $8, resultado = $9, version_rangos = $10
        WHERE id = $1 RETURNING *`,
      [intentoId, resultado.puntaje_bruto, resultado.puntaje, resultado.nivel_vulnerabilidad?.nivel ?? null,
        resultado.errores, resultado.aciertos, resultado.senales.detectadas.length, resultado.senales.total,
        resultado, resultado.version_rangos]
    );
    const { rows: [{ tipo_ataque_id: tipoId }] } = await client.query(
      'SELECT tipo_ataque_id FROM escenarios WHERE id = $1', [intento.escenario_id]
    );
    await actualizarMetricas(client, usuarioId, tipoId, rangos);

    return { intento: resumenIntento(actualizado, respuestas.length), resultado };
  });
}

async function abandonar(usuarioId, intentoId) {
  return withTransaction(async (client) => {
    const intento = await bloquearIntento(client, intentoId, usuarioId);
    if (intento.estado !== 'en_curso') throw AppError.conflict('El intento ya no está en curso');
    await client.query(`UPDATE intentos SET estado = 'abandonado', fecha_fin = now() WHERE id = $1`, [intentoId]);
  });
}

/** Estado de un intento: paso actual si está en curso, resultado si terminó. */
async function obtener(usuario, intentoId) {
  const { rows: [intento] } = await query('SELECT * FROM intentos WHERE id = $1', [intentoId]);
  if (!intento || (intento.usuario_id !== usuario.id && usuario.rol !== 'admin')) {
    throw AppError.notFound('Intento no encontrado');
  }
  const escenario = await scenariosRepo.obtenerResumen(intento.escenario_id);
  return {
    intento: resumenIntento(intento, await contarRespuestas({ query }, intentoId)),
    escenario: {
      id: escenario.id, codigo: escenario.codigo, titulo: escenario.titulo,
      tipo: escenario.tipo, tipo_nombre: escenario.tipo_nombre,
      dificultad: escenario.dificultad, dificultad_nombre: escenario.dificultad_nombre,
      contexto: escenario.contenido?.contexto ?? null,
    },
    paso: intento.estado === 'en_curso' ? await pasoPublico({ query }, intento.paso_actual_id) : null,
    resultado: intento.estado === 'finalizado' ? intento.resultado : null,
  };
}

module.exports = { iniciar, responder, finalizar, abandonar, obtener };
