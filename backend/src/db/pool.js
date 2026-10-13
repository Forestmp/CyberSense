const { Pool, types } = require('pg');
const env = require('../config/env');

// BIGINT (identity) y NUMERIC llegan como string por defecto; los valores del
// sistema caben de sobra en un Number de JavaScript.
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  max: env.DB_POOL_MAX,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

const query = (text, params) => pool.query(text, params);

/** Ejecuta `fn(client)` dentro de una transacción; hace ROLLBACK si falla. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
