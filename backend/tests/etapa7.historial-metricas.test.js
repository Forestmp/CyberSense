const { app, request, registrarUsuario, loginAdmin, auth } = require('./helpers');
const { pool } = require('../src/db/pool');

afterAll(() => pool.end());

let u;
let ph001Id;

async function jugar(token, ...textos) {
  const { body } = await request(app).post('/api/attempts').set(auth(token)).send({ escenario_id: ph001Id });
  let paso = body.paso;
  for (const t of textos) {
    const op = paso.opciones.find((o) => o.texto.startsWith(t));
    paso = (await request(app).post(`/api/attempts/${body.intento.id}/responses`).set(auth(token)).send({ opcion_id: op.id })).body.paso;
  }
  return (await request(app).post(`/api/attempts/${body.intento.id}/finish`).set(auth(token))).body;
}

beforeAll(async () => {
  ph001Id = (await pool.query(`SELECT id FROM escenarios WHERE codigo = 'PH-001'`)).rows[0].id;
  u = await registrarUsuario({ nombre: 'Historial Uno' });
});

describe('Etapa 7 · sin actividad', () => {
  test('métricas vacías con los tres tipos de ataque', async () => {
    const res = await request(app).get(`/api/users/${u.usuario.id}/metrics`).set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.resumen).toMatchObject({ total_simulaciones: 0, puntaje_promedio: null, nivel_vulnerabilidad: null, tasa_aciertos: null });
    expect(res.body.por_tipo.map((t) => [t.tipo, t.total_intentos])).toEqual([['phishing', 0], ['smishing', 0], ['suplantacion_identidad', 0]]);
    const h = await request(app).get(`/api/users/${u.usuario.id}/history`).set(auth(u.token));
    expect(h.body).toMatchObject({ datos: [], total: 0 });
  });

  test('la recomendación inicial es un escenario no realizado', async () => {
    const res = await request(app).get('/api/scenarios/recommended').set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.recomendacion).toMatchObject({ estrategia: 'reglas-provisional', escenario: { id: expect.any(Number) } });
    expect(res.body.recomendacion.motivo).toMatch(/Aún no practicas/);
  });
});

describe('Etapa 7 · con actividad', () => {
  beforeAll(async () => {
    await jugar(u.token, 'Revisar el remitente', 'Reportar el mensaje'); // 100
    await jugar(u.token, 'Abrir el enlace', 'Introducir la información'); // 0
    await jugar(u.token, 'Ignorar el mensaje'); // 69.23
    // Un intento abandonado no debe aparecer
    await request(app).post('/api/attempts').set(auth(u.token)).send({ escenario_id: ph001Id });
  });

  test('historial: solo finalizados, del más reciente al más antiguo, con datos del escenario', async () => {
    const res = await request(app).get(`/api/users/${u.usuario.id}/history`).set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.datos.map((d) => d.puntaje)).toEqual([69.23, 0, 100]);
    expect(res.body.datos[0]).toMatchObject({
      codigo: 'PH-001', titulo: 'Cuenta bancaria bloqueada', tipo: 'phishing', tipo_nombre: 'Phishing',
      dificultad_nombre: 'Básico', nivel_vulnerabilidad: 'medio', numero_intento: 3,
    });
    expect(res.body.datos[0].fecha_fin).toBeTruthy();
  });

  test('historial paginado y filtrado por tipo', async () => {
    const p = await request(app).get(`/api/users/${u.usuario.id}/history?limite=2&pagina=2`).set(auth(u.token));
    expect(p.body.datos).toHaveLength(1);
    const sm = await request(app).get(`/api/users/${u.usuario.id}/history?tipo=smishing`).set(auth(u.token));
    expect(sm.body.total).toBe(0);
  });

  test('métricas: resumen, por tipo y evolución', async () => {
    const res = await request(app).get(`/api/users/${u.usuario.id}/metrics`).set(auth(u.token));
    const { resumen, por_tipo: porTipo, evolucion } = res.body;
    expect(resumen).toMatchObject({ total_simulaciones: 3, escenarios_completados: 1, puntaje_promedio: 56.41, aciertos: 2, errores: 2, tasa_aciertos: 50, nivel_vulnerabilidad: 'alto' });
    expect(porTipo[0]).toMatchObject({ tipo: 'phishing', total_intentos: 3, aciertos: 2, errores: 2, puntaje_promedio: 56.41, ultimo_puntaje: 69.23 });
    expect(evolucion.map((e) => e.puntaje)).toEqual([100, 0, 69.23]);
  });

  test('el listado de escenarios incluye el desempeño del usuario', async () => {
    const res = await request(app).get('/api/scenarios').set(auth(u.token));
    const ph = res.body.datos.find((e) => e.codigo === 'PH-001');
    expect(ph).toMatchObject({ mis_intentos: 3, mi_mejor_puntaje: 100, mi_ultimo_nivel: 'medio' });
  });

  test('permisos: otro usuario → 403; admin → 200; usuario inexistente → 404', async () => {
    const otro = await registrarUsuario();
    expect((await request(app).get(`/api/users/${u.usuario.id}/history`).set(auth(otro.token))).status).toBe(403);
    expect((await request(app).get(`/api/users/${u.usuario.id}/metrics`).set(auth(otro.token))).status).toBe(403);
    const admin = await loginAdmin();
    expect((await request(app).get(`/api/users/${u.usuario.id}/metrics`).set(auth(admin.token))).status).toBe(200);
    expect((await request(app).get('/api/users/999999/history').set(auth(admin.token))).status).toBe(404);
  });
});

describe('Etapa 7 · vista para ML', () => {
  test('vw_dataset_intentos: una fila por intento con historial previo y etiqueta', async () => {
    const { rows } = await pool.query(
      'SELECT * FROM vw_dataset_intentos WHERE usuario_id = $1 ORDER BY fecha_fin', [u.usuario.id]
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.cometio_error)).toEqual([false, true, false]);
    expect(rows.map((r) => r.previo_intentos_mismo_tipo)).toEqual([0, 1, 2]);
    expect(rows.map((r) => r.previo_puntaje_promedio_mismo_tipo)).toEqual([null, 100, 50]);
    expect(rows[1]).toMatchObject({
      tipo_ataque: 'phishing', dificultad: 1, num_decisiones: 2, acciones_riesgosas: 1, acciones_criticas: 1,
      secuencia_decisiones: 'abrir_enlace>ingresar_datos', previo_ultimo_puntaje_mismo_tipo: 100,
    });
    expect(rows[0].tiempo_respuesta_promedio_ms).toEqual(expect.any(Number));
  });
});
