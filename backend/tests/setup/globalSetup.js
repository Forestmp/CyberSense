const fs = require('fs');
const os = require('os');
const path = require('path');
const { PORT, testEnv } = require('./testEnv');

module.exports = async () => {
  Object.assign(process.env, testEnv);
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  const databaseDir = path.join(os.tmpdir(), 'tt1-pg-test');
  fs.rmSync(databaseDir, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir, port: PORT, user: 'postgres', password: 'postgres', persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('tt_test');
  globalThis.__EMBEDDED_PG__ = pg;

  // Esquema desde cero + datos iniciales, igual que en un despliegue nuevo.
  const { migrate } = require('../../scripts/migrate');
  const { seed } = require('../../scripts/seed');
  const { pool } = require('../../src/db/pool');
  const log = console.log;
  console.log = () => {};
  try {
    await migrate();
    await seed();
  } catch (err) {
    await pg.stop();
    throw err;
  } finally {
    console.log = log;
    await pool.end();
  }
};
