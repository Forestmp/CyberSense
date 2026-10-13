/**
 * Aplica en orden los archivos de db/migrations que aún no se han ejecutado.
 *   npm run db:migrate            aplica las pendientes
 *   node scripts/migrate.js --reset   BORRA el esquema public y lo recrea (solo desarrollo)
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db/pool');
const env = require('../src/config/env');

const DIR = path.join(__dirname, '..', 'db', 'migrations');

async function reset(client) {
  if (env.NODE_ENV === 'production') throw new Error('--reset no está permitido en producción');
  // Se eliminan solo nuestros objetos para no tocar extensiones ni objetos de Supabase.
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );
  for (const { tablename } of rows) {
    await client.query(`DROP TABLE IF EXISTS public."${tablename}" CASCADE`);
  }
  const views = await client.query(`SELECT viewname FROM pg_views WHERE schemaname = 'public'`);
  for (const { viewname } of views.rows) {
    await client.query(`DROP VIEW IF EXISTS public."${viewname}" CASCADE`);
  }
  await client.query('DROP FUNCTION IF EXISTS fn_set_fecha_actualizacion() CASCADE');
  console.log('Esquema reiniciado.');
}

async function migrate({ resetFirst = false } = {}) {
  const client = await pool.connect();
  try {
    if (resetFirst) await reset(client);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre     VARCHAR(255) PRIMARY KEY,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await client.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');

    const { rows } = await client.query('SELECT nombre FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.nombre));
    const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

    let n = 0;
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        console.log(`✔ ${archivo}`);
        n++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${archivo}: ${err.message}`);
      }
    }
    console.log(n ? `${n} migración(es) aplicada(s).` : 'Sin migraciones pendientes.');
  } finally {
    client.release();
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate({ resetFirst: process.argv.includes('--reset') })
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      pool.end();
      process.exit(1);
    });
}
