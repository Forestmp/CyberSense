/** Datos de configuración que usa el motor de evaluación. */

async function rangosActivos(db) {
  const { rows } = await db.query(
    `SELECT version, nivel, nombre, puntaje_min, puntaje_max, descripcion, recomendacion
       FROM rangos_vulnerabilidad WHERE activo ORDER BY puntaje_min`
  );
  return rows;
}

async function reglasGlobales(db) {
  const { rows } = await db.query(
    `SELECT tipo_regla, parametros, ajuste_puntuacion, descripcion, retroalimentacion, activa
       FROM reglas_evaluacion WHERE escenario_id IS NULL AND activa ORDER BY prioridad, id`
  );
  return rows;
}

module.exports = { rangosActivos, reglasGlobales };
