const { query } = require('../../db/pool');

const CAMPOS_PUBLICOS = 'id, nombre, correo, rol, estado, fecha_registro, fecha_actualizacion, fecha_eliminacion';

async function findById(id) {
  const { rows } = await query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByEmailWithHash(correo) {
  const { rows } = await query(
    `SELECT ${CAMPOS_PUBLICOS}, password_hash FROM usuarios WHERE lower(correo) = lower($1)`,
    [correo]
  );
  return rows[0] || null;
}

async function getPasswordHash(id) {
  const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1', [id]);
  return rows[0]?.password_hash ?? null;
}

/**
 * Listado paginado. Sin filtro de estado se excluyen los eliminados.
 * Incluye el total de intentos finalizados de cada usuario.
 */
async function list({ pagina, limite, buscar, rol, estado }) {
  const condiciones = [];
  const params = [];
  if (buscar) {
    params.push(`%${buscar.replace(/[\\%_]/g, '\\$&')}%`);
    condiciones.push(`(u.nombre ILIKE $${params.length} OR u.correo ILIKE $${params.length})`);
  }
  if (rol) {
    params.push(rol);
    condiciones.push(`u.rol = $${params.length}`);
  }
  if (estado) {
    params.push(estado);
    condiciones.push(`u.estado = $${params.length}`);
  } else {
    condiciones.push(`u.estado <> 'eliminado'`);
  }
  const where = `WHERE ${condiciones.join(' AND ')}`;

  const total = (await query(`SELECT count(*)::int AS n FROM usuarios u ${where}`, params)).rows[0].n;
  params.push(limite, (pagina - 1) * limite);
  const { rows } = await query(
    `SELECT ${CAMPOS_PUBLICOS.split(', ').map((c) => `u.${c}`).join(', ')},
            (SELECT count(*)::int FROM intentos i WHERE i.usuario_id = u.id AND i.estado = 'finalizado') AS intentos_finalizados
       FROM usuarios u ${where}
      ORDER BY u.fecha_registro DESC, u.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { datos: rows, total, pagina, limite, paginas: Math.ceil(total / limite) };
}

async function create({ nombre, correo, passwordHash, rol = 'usuario', estado = 'activo' }) {
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${CAMPOS_PUBLICOS}`,
    [nombre, correo, passwordHash, rol, estado]
  );
  return rows[0];
}

/** Actualiza solo las columnas presentes en `cambios` (lista blanca). */
async function update(id, cambios) {
  const permitidas = ['nombre', 'correo', 'password_hash', 'rol', 'estado', 'fecha_eliminacion'];
  const columnas = Object.keys(cambios).filter((k) => permitidas.includes(k) && cambios[k] !== undefined);
  if (!columnas.length) return findById(id);
  const sets = columnas.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const { rows } = await query(
    `UPDATE usuarios SET ${sets} WHERE id = $1 RETURNING ${CAMPOS_PUBLICOS}`,
    [id, ...columnas.map((c) => cambios[c])]
  );
  return rows[0] || null;
}

async function softDelete(id) {
  await query(`UPDATE usuarios SET estado = 'eliminado', fecha_eliminacion = now() WHERE id = $1`, [id]);
}

module.exports = { findById, findByEmailWithHash, getPasswordHash, list, create, update, softDelete };
