/**
 * Selección del siguiente escenario.
 *
 * Punto de extensión para el futuro motor adaptativo: cada estrategia recibe
 * el contexto del usuario y devuelve { escenario_id, motivo }. Hoy solo existe
 * una estrategia provisional basada en reglas simples; cuando exista el modelo
 * de clasificación se agregará una estrategia que use la probabilidad de
 * error estimada por escenario, sin cambiar la API.
 */
const { query } = require('../../db/pool');

async function contexto(usuarioId) {
  const { rows } = await query(
    `SELECT e.id, e.codigo, e.titulo, t.clave AS tipo, t.nombre AS tipo_nombre, d.valor AS dificultad,
            m.puntaje_promedio AS promedio_tipo,
            (SELECT count(*)::int FROM intentos i
              WHERE i.usuario_id = $1 AND i.escenario_id = e.id AND i.estado = 'finalizado') AS completados,
            (SELECT i.puntaje FROM intentos i
              WHERE i.usuario_id = $1 AND i.escenario_id = e.id AND i.estado = 'finalizado'
              ORDER BY i.fecha_fin DESC LIMIT 1)::float AS ultimo_puntaje
       FROM escenarios e
       JOIN tipos_ataque t ON t.id = e.tipo_ataque_id
       JOIN niveles_dificultad d ON d.id = e.dificultad_id
       LEFT JOIN metricas_usuario m ON m.usuario_id = $1 AND m.tipo_ataque_id = e.tipo_ataque_id
      WHERE e.estado = 'activo'`,
    [usuarioId]
  );
  return rows;
}

const estrategias = {
  /**
   * Provisional: 1) escenarios no realizados, del tipo con menor promedio y
   * menor dificultad; 2) si ya hizo todos, el de menor último puntaje.
   */
  'reglas-provisional': (candidatos) => {
    const promedio = (c) => (c.promedio_tipo == null ? -1 : c.promedio_tipo); // sin datos = prioridad
    const nuevos = candidatos.filter((c) => c.completados === 0)
      .sort((a, b) => promedio(a) - promedio(b) || a.dificultad - b.dificultad || a.codigo.localeCompare(b.codigo));
    if (nuevos.length) {
      const c = nuevos[0];
      return { escenario: c, motivo: c.promedio_tipo == null ? `Aún no practicas ${c.tipo_nombre.toLowerCase()}` : 'Escenario que aún no has realizado' };
    }
    const repaso = [...candidatos].sort((a, b) => a.ultimo_puntaje - b.ultimo_puntaje || a.dificultad - b.dificultad);
    if (!repaso.length) return null;
    return { escenario: repaso[0], motivo: 'Es donde obtuviste tu puntaje más bajo; vale la pena repasarlo' };
  },
};

const ESTRATEGIA_ACTUAL = 'reglas-provisional';

async function seleccionarSiguiente(usuarioId, estrategia = ESTRATEGIA_ACTUAL) {
  const candidatos = await contexto(usuarioId);
  const r = estrategias[estrategia](candidatos);
  if (!r) return null;
  const { id, codigo, titulo, tipo, tipo_nombre } = r.escenario;
  return { escenario: { id, codigo, titulo, tipo, tipo_nombre }, motivo: r.motivo, estrategia };
}

module.exports = { seleccionarSiguiente, estrategias };
