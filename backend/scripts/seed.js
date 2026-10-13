/**
 * Carga datos iniciales. Idempotente: no duplica registros existentes.
 *  1. Archivos .sql de db/seeds (catálogos, rangos provisionales).
 *  2. Escenarios de db/seeds/escenarios/*.json (se omiten si su código ya existe).
 *  3. Usuario administrador, si ADMIN_EMAIL y ADMIN_PASSWORD están definidos.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const { pool, withTransaction } = require('../src/db/pool');
const repo = require('../src/modules/scenarios/scenarios.repository');
const { validarEstructura } = require('../src/modules/scenarios/scenarios.structure');

const DIR = path.join(__dirname, '..', 'db', 'seeds');

async function seedSql() {
  const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    await pool.query(fs.readFileSync(path.join(DIR, archivo), 'utf8'));
    console.log(`✔ ${archivo}`);
  }
}

async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('· Administrador omitido (define ADMIN_EMAIL y ADMIN_PASSWORD en .env)');
    return null;
  }
  const existente = await pool.query('SELECT id FROM usuarios WHERE lower(correo) = lower($1)', [ADMIN_EMAIL]);
  if (existente.rows.length) {
    console.log(`· Administrador ${ADMIN_EMAIL} ya existe`);
    return existente.rows[0].id;
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, lower($2), $3, 'admin') RETURNING id`,
    [ADMIN_NAME || 'Administrador', ADMIN_EMAIL, hash]
  );
  console.log(`✔ Administrador ${ADMIN_EMAIL} creado`);
  return rows[0].id;
}

async function seedEscenarios(adminId) {
  const dir = path.join(DIR, 'escenarios');
  for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, archivo), 'utf8'));
    const errores = validarEstructura(doc);
    if (errores.length) throw new Error(`${archivo} inválido:\n  - ${errores.join('\n  - ')}`);

    const existe = await pool.query('SELECT 1 FROM escenarios WHERE codigo = $1', [doc.codigo]);
    if (existe.rows.length) {
      console.log(`· Escenario ${doc.codigo} ya existe`);
      continue;
    }
    await withTransaction(async (client) => {
      const cat = await repo.resolverCatalogos(client, doc.tipo, doc.dificultad);
      if (!cat.tipo_ataque_id || !cat.dificultad_id) throw new Error(`${archivo}: tipo o dificultad desconocidos`);
      const { rows } = await client.query(
        `INSERT INTO escenarios (codigo, titulo, tipo_ataque_id, dificultad_id, descripcion, contenido,
                                 retroalimentacion_general, estado, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [doc.codigo, doc.titulo, cat.tipo_ataque_id, cat.dificultad_id, doc.descripcion, doc.contenido || {},
          doc.retroalimentacion_general || null, doc.estado || 'borrador', adminId]
      );
      await repo.insertarEstructura(client, rows[0].id, doc);
    });
    console.log(`✔ Escenario ${doc.codigo} · ${doc.titulo}`);
  }
}

async function seed() {
  await seedSql();
  const adminId = await seedAdmin();
  await seedEscenarios(adminId);
}

module.exports = { seed };

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      pool.end();
      process.exit(1);
    });
}
