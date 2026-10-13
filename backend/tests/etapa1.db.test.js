const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');
const { migrate } = require('../scripts/migrate');
const { seed } = require('../scripts/seed');
const { validarEstructura } = require('../src/modules/scenarios/scenarios.structure');
const ph001 = require('../db/seeds/escenarios/PH-001.json');

afterAll(() => pool.end());

const silenciar = async (fn) => {
  const log = console.log;
  console.log = () => {};
  try { return await fn(); } finally { console.log = log; }
};

describe('Etapa 1 · base de datos', () => {
  test('GET /api/health responde ok con la BD conectada', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
  });

  test('ruta inexistente → 404 en JSON', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('se crean todas las tablas con RLS habilitado', async () => {
    const { rows } = await pool.query(
      `SELECT relname, relrowsecurity FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname`
    );
    const tablas = rows.map((r) => r.relname);
    expect(tablas).toEqual(expect.arrayContaining([
      'usuarios', 'tipos_ataque', 'niveles_dificultad', 'rangos_vulnerabilidad', 'escenarios',
      'escenario_pasos', 'senales_alerta', 'opciones', 'opcion_senal', 'reglas_evaluacion',
      'intentos', 'respuestas_usuario', 'metricas_usuario', 'schema_migrations',
    ]));
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  test('migración y seed son idempotentes', async () => {
    await silenciar(async () => { await migrate(); await seed(); });
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM escenarios WHERE codigo = 'PH-001'`);
    expect(rows[0].n).toBe(1);
    const tipos = await pool.query('SELECT count(*)::int AS n FROM tipos_ataque');
    expect(tipos.rows[0].n).toBe(3);
  });

  test('PH-001 se cargó con su estructura ramificada', async () => {
    const { rows: [esc] } = await pool.query(
      `SELECT e.id, e.estado, t.clave AS tipo, d.clave AS dificultad
         FROM escenarios e JOIN tipos_ataque t ON t.id = e.tipo_ataque_id
         JOIN niveles_dificultad d ON d.id = e.dificultad_id WHERE codigo = 'PH-001'`
    );
    expect(esc).toMatchObject({ estado: 'activo', tipo: 'phishing', dificultad: 'basico' });

    const conteo = async (sql) => (await pool.query(sql, [esc.id])).rows[0].n;
    expect(await conteo('SELECT count(*)::int AS n FROM escenario_pasos WHERE escenario_id = $1')).toBe(4);
    expect(await conteo('SELECT count(*)::int AS n FROM senales_alerta WHERE escenario_id = $1')).toBe(4);
    expect(await conteo('SELECT count(*)::int AS n FROM reglas_evaluacion WHERE escenario_id = $1')).toBe(3);
    expect(await conteo(
      'SELECT count(*)::int AS n FROM opciones o JOIN escenario_pasos p ON p.id = o.paso_id WHERE p.escenario_id = $1'
    )).toBe(15);

    // "Abrir el enlace" lleva al sitio falso (segunda decisión).
    const { rows: [abrir] } = await pool.query(
      `SELECT sp.clave AS siguiente FROM opciones o
         JOIN escenario_pasos p ON p.id = o.paso_id
         JOIN escenario_pasos sp ON sp.id = o.siguiente_paso_id
        WHERE p.escenario_id = $1 AND o.clave = 'abrir_enlace'`, [esc.id]
    );
    expect(abrir.siguiente).toBe('sitio_falso');
  });

  test('rangos provisionales activos cubren 0–100', async () => {
    const { rows } = await pool.query(
      'SELECT nivel, puntaje_min, puntaje_max FROM rangos_vulnerabilidad WHERE activo ORDER BY puntaje_min'
    );
    expect(rows.map((r) => r.nivel)).toEqual(['critico', 'alto', 'medio', 'bajo']);
    expect(rows[0].puntaje_min).toBe(0);
    expect(rows[3].puntaje_max).toBe(100);
  });

  test('el correo de usuario es único sin distinguir mayúsculas', async () => {
    await expect(pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash) VALUES ('X', 'ADMIN@TEST.LOCAL', 'x')`
    )).rejects.toMatchObject({ code: '23505' });
  });
});

describe('Etapa 1 · validación de estructura de escenarios', () => {
  const clonar = () => JSON.parse(JSON.stringify(ph001));

  test('PH-001 es válido', () => {
    expect(validarEstructura(ph001)).toEqual([]);
  });

  test('detecta ciclos', () => {
    const doc = clonar();
    doc.pasos.find((p) => p.clave === 'sitio_falso').opciones[0].siguiente_paso = 'correo';
    expect(validarEstructura(doc).join()).toMatch(/ciclo/);
  });

  test('detecta pasos inalcanzables y referencias rotas', () => {
    const doc = clonar();
    doc.pasos[0].opciones[1].siguiente_paso = null; // detalle_remitente queda aislado
    doc.pasos[0].opciones[0].senales = ['no_existe'];
    const errores = validarEstructura(doc).join('\n');
    expect(errores).toMatch(/señal inexistente/);
    const doc2 = clonar();
    doc2.pasos[0].opciones[1].siguiente_paso = null;
    expect(validarEstructura(doc2).join()).toMatch(/detalle_remitente no es alcanzable/);
  });
});
