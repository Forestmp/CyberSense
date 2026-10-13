const { query } = require('../../db/pool');

const CAMPOS_PUBLICOS = 'id, nombre, correo, rol, estado, fecha_registro, fecha_actualizacion';

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

async function create({ nombre, correo, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, correo, password_hash) VALUES ($1, $2, $3) RETURNING ${CAMPOS_PUBLICOS}`,
    [nombre, correo, passwordHash]
  );
  return rows[0];
}

/** Actualiza solo las columnas presentes en `cambios` (lista blanca). */
async function update(id, cambios) {
  const permitidas = ['nombre', 'correo', 'password_hash', 'rol', 'estado'];
  const columnas = Object.keys(cambios).filter((k) => permitidas.includes(k) && cambios[k] !== undefined);
  if (!columnas.length) return findById(id);
  const sets = columnas.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const { rows } = await query(
    `UPDATE usuarios SET ${sets} WHERE id = $1 RETURNING ${CAMPOS_PUBLICOS}`,
    [id, ...columnas.map((c) => cambios[c])]
  );
  return rows[0] || null;
}

module.exports = { findById, findByEmailWithHash, getPasswordHash, create, update };
