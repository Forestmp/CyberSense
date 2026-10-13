const { withTransaction } = require('../../db/pool');
const AppError = require('../../utils/AppError');
const repo = require('./scenarios.repository');
const { validarEstructura } = require('./scenarios.structure');

async function validarDocumento(client, doc) {
  const errores = validarEstructura(doc);
  const cat = await repo.resolverCatalogos(client, doc.tipo, doc.dificultad);
  if (!cat.tipo_ataque_id) errores.push(`Tipo de ataque desconocido: ${doc.tipo}`);
  if (!cat.dificultad_id) errores.push(`Dificultad desconocida: ${doc.dificultad}`);
  if (errores.length) {
    throw AppError.badRequest('La estructura del escenario no es válida', errores.map((mensaje) => ({ campo: 'body', mensaje })));
  }
  return cat;
}

async function crear(doc, usuarioId) {
  const id = await withTransaction(async (client) => {
    const cat = await validarDocumento(client, doc);
    return repo.crear(client, doc, cat, usuarioId);
  });
  return repo.obtenerDocumento(id);
}

/**
 * Reemplaza el contenido del escenario. Los intentos en curso se marcan como
 * abandonados porque su paso actual puede haber cambiado o desaparecido.
 */
async function actualizar(id, doc) {
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT estado FROM escenarios WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length || rows[0].estado === 'eliminado') throw AppError.notFound('Escenario no encontrado');
    const cat = await validarDocumento(client, doc);
    await repo.actualizarMetadatos(client, id, doc, cat);
    await repo.reemplazarEstructura(client, id, doc);
    await client.query(
      `UPDATE intentos SET estado = 'abandonado', fecha_fin = now() WHERE escenario_id = $1 AND estado = 'en_curso'`, [id]
    );
  });
  return repo.obtenerDocumento(id);
}

async function cambiarEstado(id, estado) {
  const actual = await repo.obtenerResumen(id);
  if (!actual || actual.estado === 'eliminado') throw AppError.notFound('Escenario no encontrado');
  await repo.cambiarEstado(id, estado);
  return repo.obtenerResumen(id);
}

/** Eliminación lógica: el escenario deja de mostrarse, pero su historial se conserva. */
async function eliminar(id) {
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE escenarios SET estado = 'eliminado' WHERE id = $1 AND estado <> 'eliminado' RETURNING id`, [id]
    );
    if (!rows.length) throw AppError.notFound('Escenario no encontrado');
    await client.query(
      `UPDATE intentos SET estado = 'abandonado', fecha_fin = now() WHERE escenario_id = $1 AND estado = 'en_curso'`, [id]
    );
  });
}

module.exports = { crear, actualizar, cambiarEstado, eliminar };
