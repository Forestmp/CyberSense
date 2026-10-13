const { query } = require('../../db/pool');
const { clasificar } = require('../evaluation/engine');
const { rangosActivos } = require('../evaluation/evaluation.repository');

async function historial(usuarioId, { pagina, limite, tipo }) {
  const params = [usuarioId];
  let filtro = '';
  if (tipo) {
    params.push(tipo);
    filtro = `AND t.clave = $${params.length}`;
  }
  const from = `
    FROM intentos i
    JOIN escenarios e ON e.id = i.escenario_id
    JOIN tipos_ataque t ON t.id = e.tipo_ataque_id
    JOIN niveles_dificultad d ON d.id = e.dificultad_id
   WHERE i.usuario_id = $1 AND i.estado = 'finalizado' ${filtro}`;

  const total = (await query(`SELECT count(*)::int AS n ${from}`, params)).rows[0].n;
  params.push(limite, (pagina - 1) * limite);
  const { rows } = await query(
    `SELECT i.id AS intento_id, i.numero_intento, i.fecha_inicio, i.fecha_fin, i.duracion_ms,
            i.puntaje, i.nivel_vulnerabilidad, i.aciertos, i.errores, i.senales_detectadas, i.senales_totales,
            e.id AS escenario_id, e.codigo, e.titulo, t.clave AS tipo, t.nombre AS tipo_nombre,
            d.clave AS dificultad, d.nombre AS dificultad_nombre
     ${from}
     ORDER BY i.fecha_fin DESC, i.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { datos: rows, total, pagina, limite, paginas: Math.ceil(total / limite) };
}

async function metricas(usuarioId) {
  const rangos = await rangosActivos({ query });
  const nivelDe = (p) => (p == null ? null : clasificar(p, rangos)?.nivel ?? null);

  const { rows: porTipo } = await query(
    `SELECT t.clave AS tipo, t.nombre AS tipo_nombre,
            COALESCE(m.total_intentos, 0) AS total_intentos, COALESCE(m.aciertos, 0) AS aciertos,
            COALESCE(m.errores, 0) AS errores, m.puntaje_promedio, m.ultimo_puntaje, m.nivel_vulnerabilidad,
            m.ultima_actualizacion
       FROM tipos_ataque t
       LEFT JOIN metricas_usuario m ON m.tipo_ataque_id = t.id AND m.usuario_id = $1
      ORDER BY t.id`,
    [usuarioId]
  );

  const { rows: [g] } = await query(
    `SELECT count(*)::int AS total_simulaciones,
            count(DISTINCT i.escenario_id)::int AS escenarios_completados,
            round(avg(i.puntaje), 2)::float AS puntaje_promedio,
            COALESCE(sum(i.aciertos), 0)::int AS aciertos,
            COALESCE(sum(i.errores), 0)::int AS errores,
            (SELECT count(*)::int FROM escenarios WHERE estado = 'activo') AS escenarios_disponibles
       FROM intentos i WHERE i.usuario_id = $1 AND i.estado = 'finalizado'`,
    [usuarioId]
  );

  const { rows: evolucion } = await query(
    `SELECT * FROM (
       SELECT i.id AS intento_id, i.fecha_fin, i.puntaje, e.codigo
         FROM intentos i JOIN escenarios e ON e.id = i.escenario_id
        WHERE i.usuario_id = $1 AND i.estado = 'finalizado'
        ORDER BY i.fecha_fin DESC LIMIT 10) x
     ORDER BY fecha_fin`,
    [usuarioId]
  );

  const decisiones = g.aciertos + g.errores;
  return {
    resumen: {
      ...g,
      tasa_aciertos: decisiones ? Math.round((g.aciertos / decisiones) * 100) : null,
      nivel_vulnerabilidad: nivelDe(g.puntaje_promedio),
    },
    por_tipo: porTipo,
    evolucion,
    nota: 'Los rangos de vulnerabilidad son provisionales y se definirán formalmente durante el análisis del proyecto.',
  };
}

/** Estadísticas del usuario por escenario (para el listado de simulaciones). */
async function estadisticasPorEscenario(usuarioId) {
  const { rows } = await query(
    `SELECT escenario_id, count(*)::int AS intentos, max(puntaje)::float AS mejor_puntaje,
            (array_agg(puntaje ORDER BY fecha_fin DESC))[1]::float AS ultimo_puntaje,
            (array_agg(nivel_vulnerabilidad ORDER BY fecha_fin DESC))[1] AS ultimo_nivel
       FROM intentos WHERE usuario_id = $1 AND estado = 'finalizado'
      GROUP BY escenario_id`,
    [usuarioId]
  );
  return new Map(rows.map((r) => [r.escenario_id, r]));
}

module.exports = { historial, metricas, estadisticasPorEscenario };
