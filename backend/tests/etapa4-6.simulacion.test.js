const { app, request, registrarUsuario, loginAdmin, auth } = require('./helpers');
const { pool } = require('../src/db/pool');

afterAll(() => pool.end());

let usuario;
let ph001Id;
beforeAll(async () => {
  usuario = await registrarUsuario({ nombre: 'Jugador Uno' });
  ph001Id = (await pool.query(`SELECT id FROM escenarios WHERE codigo = 'PH-001'`)).rows[0].id;
});

const iniciar = (token = usuario.token) =>
  request(app).post('/api/attempts').set(auth(token)).send({ escenario_id: ph001Id });

/** Elige la opción cuyo texto empieza con `texto` en el paso recibido. */
const elegir = (intentoId, paso, texto, token = usuario.token) => {
  const opcion = paso.opciones.find((o) => o.texto.startsWith(texto));
  if (!opcion) throw new Error(`Opción "${texto}" no está en el paso "${paso.titulo}"`);
  return request(app).post(`/api/attempts/${intentoId}/responses`).set(auth(token)).send({ opcion_id: opcion.id });
};

describe('Etapa 4 · ejecución de una simulación', () => {
  test('iniciar devuelve el primer paso sin revelar puntuaciones ni retroalimentación', async () => {
    const res = await iniciar();
    expect(res.status).toBe(201);
    expect(res.body.intento).toMatchObject({ estado: 'en_curso', numero_intento: 1, terminado: false });
    expect(res.body.escenario).toMatchObject({ codigo: 'PH-001', tipo: 'phishing' });
    expect(res.body.paso.contenido.formato).toBe('correo');
    expect(res.body.paso.opciones).toHaveLength(4);
    expect(Object.keys(res.body.paso.opciones[0]).sort()).toEqual(['id', 'texto']);
    expect(JSON.stringify(res.body)).not.toMatch(/puntuacion|tipo_accion|retroalimentacion|siguiente_paso/);
  });

  test('recorrido de varias decisiones: abrir enlace → revisar URL → cerrar y reportar', async () => {
    const { body: ini } = await iniciar();
    const id = ini.intento.id;
    expect(ini.intento.numero_intento).toBe(2);

    const r1 = await elegir(id, ini.paso, 'Abrir el enlace');
    expect(r1.status).toBe(201);
    expect(r1.body.paso.titulo).toBe('Se abrió una página web');
    expect(r1.body.intento).toMatchObject({ decisiones_tomadas: 1, terminado: false });
    expect(JSON.stringify(r1.body)).not.toMatch(/puntuacion|tipo_accion|retroalimentacion|correcta|incorrecta/);

    const r2 = await elegir(id, r1.body.paso, 'Revisar la dirección');
    expect(r2.body.paso.titulo).toBe('Dirección de la página');

    const r3 = await elegir(id, r2.body.paso, 'Cerrar la página y reportar');
    expect(r3.body).toMatchObject({ paso: null, intento: { terminado: true, decisiones_tomadas: 3 } });

    const { rows } = await pool.query(
      'SELECT orden, opcion_clave, tipo_accion, puntuacion, tiempo_respuesta_ms FROM respuestas_usuario WHERE intento_id = $1 ORDER BY orden', [id]
    );
    expect(rows.map((r) => r.opcion_clave)).toEqual(['abrir_enlace', 'revisar_url', 'cerrar_y_reportar']);
    expect(rows.every((r) => Number.isInteger(r.tiempo_respuesta_ms) && r.tiempo_respuesta_ms >= 0)).toBe(true);

    // Etapa 5–6: finalizar
    const fin = await request(app).post(`/api/attempts/${id}/finish`).set(auth(usuario.token));
    expect(fin.status).toBe(200);
    const res = fin.body.resultado;
    expect(res).toMatchObject({ puntaje: 84.62, puntaje_bruto: 15, aciertos: 2, errores: 1, total_decisiones: 3 });
    expect(res.nivel_vulnerabilidad.nivel).toBe('bajo');
    expect(res.errores_detalle.map((d) => d.opcion)).toEqual(['Abrir el enlace']);
    expect(res.senales.detectadas.map((s) => s.clave)).toEqual(['enlace_no_oficial', 'solicitud_datos_sensibles']);
    expect(res.recomendaciones.length).toBeGreaterThan(0);
    expect(fin.body.intento.estado).toBe('finalizado');

    // Persistencia en intentos
    const { rows: [i] } = await pool.query('SELECT * FROM intentos WHERE id = $1', [id]);
    expect(i).toMatchObject({ estado: 'finalizado', puntaje: 84.62, nivel_vulnerabilidad: 'bajo', errores: 1, aciertos: 2, senales_detectadas: 2, senales_totales: 4, version_rangos: 'v0-provisional' });
    expect(i.duracion_ms).toBeGreaterThanOrEqual(0);

    // Finalizar de nuevo es idempotente
    const otra = await request(app).post(`/api/attempts/${id}/finish`).set(auth(usuario.token));
    expect(otra.body.resultado.puntaje).toBe(84.62);

    // GET devuelve el resultado guardado
    const get = await request(app).get(`/api/attempts/${id}`).set(auth(usuario.token));
    expect(get.body).toMatchObject({ paso: null, resultado: { puntaje: 84.62 }, intento: { estado: 'finalizado' } });
  });

  test('iniciar un intento nuevo abandona el que estaba en curso', async () => {
    const a = (await iniciar()).body.intento.id;
    const b = (await iniciar()).body.intento.id;
    const { rows } = await pool.query('SELECT id, estado FROM intentos WHERE id = ANY($1) ORDER BY id', [[a, b]]);
    expect(rows.map((r) => r.estado)).toEqual(['abandonado', 'en_curso']);
    const r = await request(app).post(`/api/attempts/${a}/responses`).set(auth(usuario.token)).send({ opcion_id: 1 });
    expect(r.status).toBe(409);
  });
});

describe('Etapa 4 · validaciones', () => {
  test('opción de otro paso → 400; finalizar con decisiones pendientes → 409', async () => {
    const { body } = await iniciar();
    const { rows } = await pool.query(
      `SELECT o.id FROM opciones o JOIN escenario_pasos p ON p.id = o.paso_id WHERE p.clave = 'detalle_url' AND p.escenario_id = $1 LIMIT 1`,
      [ph001Id]
    );
    const r = await request(app).post(`/api/attempts/${body.intento.id}/responses`).set(auth(usuario.token)).send({ opcion_id: rows[0].id });
    expect(r.status).toBe(400);
    const fin = await request(app).post(`/api/attempts/${body.intento.id}/finish`).set(auth(usuario.token));
    expect(fin.status).toBe(409);
  });

  test('responder después de terminar → 409', async () => {
    const { body } = await iniciar();
    await elegir(body.intento.id, body.paso, 'Ignorar el mensaje');
    const r = await elegir(body.intento.id, body.paso, 'Abrir el enlace');
    expect(r.status).toBe(409);
  });

  test('otro usuario no puede ver ni responder el intento (404)', async () => {
    const { body } = await iniciar();
    const otro = await registrarUsuario();
    expect((await request(app).get(`/api/attempts/${body.intento.id}`).set(auth(otro.token))).status).toBe(404);
    expect((await elegir(body.intento.id, body.paso, 'Ignorar', otro.token)).status).toBe(404);
    // El administrador sí puede consultarlo.
    const admin = await loginAdmin();
    expect((await request(app).get(`/api/attempts/${body.intento.id}`).set(auth(admin.token))).status).toBe(200);
  });

  test('escenario inexistente o inactivo → 404; body inválido → 400', async () => {
    expect((await request(app).post('/api/attempts').set(auth(usuario.token)).send({ escenario_id: 999999 })).status).toBe(404);
    expect((await request(app).post('/api/attempts').set(auth(usuario.token)).send({})).status).toBe(400);
  });

  test('abandonar → 204 y ya no acepta respuestas', async () => {
    const { body } = await iniciar();
    expect((await request(app).post(`/api/attempts/${body.intento.id}/abandon`).set(auth(usuario.token))).status).toBe(204);
    expect((await elegir(body.intento.id, body.paso, 'Ignorar')).status).toBe(409);
  });
});

describe('Etapa 6 · métricas actualizadas al finalizar', () => {
  test('metricas_usuario acumula intentos, aciertos, errores y promedio por tipo', async () => {
    const u = await registrarUsuario();
    const jugar = async (...textos) => {
      const { body } = await iniciar(u.token);
      let paso = body.paso;
      for (const t of textos) paso = (await elegir(body.intento.id, paso, t, u.token)).body.paso;
      return (await request(app).post(`/api/attempts/${body.intento.id}/finish`).set(auth(u.token))).body.resultado;
    };
    const r1 = await jugar('Revisar el remitente', 'Reportar el mensaje');
    const r2 = await jugar('Abrir el enlace', 'Introducir la información');
    expect([r1.puntaje, r2.puntaje]).toEqual([100, 0]);

    const { rows: [m] } = await pool.query(
      `SELECT m.* FROM metricas_usuario m JOIN tipos_ataque t ON t.id = m.tipo_ataque_id
        WHERE m.usuario_id = $1 AND t.clave = 'phishing'`, [u.usuario.id]
    );
    expect(m).toMatchObject({ total_intentos: 2, aciertos: 2, errores: 2, puntaje_promedio: 50, ultimo_puntaje: 0, nivel_vulnerabilidad: 'alto' });
  });
});
