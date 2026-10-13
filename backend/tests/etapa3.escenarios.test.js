const { app, request, registrarUsuario, loginAdmin, auth } = require('./helpers');
const { pool } = require('../src/db/pool');
const ph001 = require('../db/seeds/escenarios/PH-001.json');

afterAll(() => pool.end());

/** Escenario mínimo válido de smishing con dos pasos. */
function docSmishing(extra = {}) {
  return {
    titulo: 'Paquete retenido',
    tipo: 'smishing',
    dificultad: 'basico',
    descripcion: 'Un SMS indica que tu paquete está retenido.',
    estado: 'activo',
    contenido: { contexto: 'Esperas un paquete.' },
    senales: [{ clave: 'url_rara', descripcion: 'Enlace acortado', explicacion: 'Oculta el destino real.' }],
    pasos: [
      {
        clave: 'sms', titulo: 'SMS', pregunta: '¿Qué haces?', es_inicial: true,
        contenido: { formato: 'sms', remitente: '55 1234 5678', mensaje: 'Tu paquete está retenido: bit.ly/x' },
        opciones: [
          { clave: 'abrir', texto: 'Abrir enlace', tipo_accion: 'riesgosa', puntuacion: -10, retroalimentacion: 'Riesgoso', siguiente_paso: 'web' },
          { clave: 'verificar', texto: 'Verificar en la paquetería', tipo_accion: 'segura', puntuacion: 10, retroalimentacion: 'Bien', senales: ['url_rara'] },
        ],
      },
      {
        clave: 'web', titulo: 'Página de pago', pregunta: '¿Pagas?',
        contenido: { formato: 'sitio_web', url: 'http://paq.example', campos: ['Tarjeta'] },
        opciones: [
          { clave: 'pagar', texto: 'Pagar', tipo_accion: 'critica', puntuacion: -30, retroalimentacion: 'Grave' },
          { clave: 'cerrar', texto: 'Cerrar', tipo_accion: 'segura', puntuacion: 5, retroalimentacion: 'Bien' },
        ],
      },
    ],
    reglas: [
      { tipo_regla: 'TIPO_ACCION_PRESENTE', parametros: { tipo_accion: 'critica' }, ajuste_puntuacion: -5, descripcion: 'Pagó' },
    ],
    ...extra,
  };
}

let admin;
let usuario;
beforeAll(async () => {
  admin = await loginAdmin();
  usuario = await registrarUsuario();
});

describe('Etapa 3 · catálogos', () => {
  test('GET /api/catalogos devuelve tipos, dificultades y enumeraciones', async () => {
    const res = await request(app).get('/api/catalogos').set(auth(usuario.token));
    expect(res.status).toBe(200);
    expect(res.body.tipos_ataque.map((t) => t.clave)).toEqual(['phishing', 'smishing', 'suplantacion_identidad']);
    expect(res.body.dificultades.map((d) => d.clave)).toEqual(['basico', 'intermedio', 'avanzado']);
    expect(res.body.tipos_accion).toContain('critica');
  });
});

describe('Etapa 3 · permisos', () => {
  test('un usuario no puede crear, editar ni eliminar (403)', async () => {
    expect((await request(app).post('/api/scenarios').set(auth(usuario.token)).send(docSmishing())).status).toBe(403);
    expect((await request(app).put('/api/scenarios/1').set(auth(usuario.token)).send(docSmishing())).status).toBe(403);
    expect((await request(app).patch('/api/scenarios/1').set(auth(usuario.token)).send({ estado: 'inactivo' })).status).toBe(403);
    expect((await request(app).delete('/api/scenarios/1').set(auth(usuario.token))).status).toBe(403);
  });

  test('un usuario ve el resumen, pero nunca opciones, puntuaciones ni reglas', async () => {
    const lista = await request(app).get('/api/scenarios').set(auth(usuario.token));
    expect(lista.status).toBe(200);
    const ph = lista.body.datos.find((e) => e.codigo === 'PH-001');
    expect(ph).toMatchObject({ titulo: 'Cuenta bancaria bloqueada', tipo: 'phishing', dificultad: 'basico' });

    const det = await request(app).get(`/api/scenarios/${ph.id}`).set(auth(usuario.token));
    expect(det.status).toBe(200);
    const json = JSON.stringify(det.body);
    expect(json).not.toMatch(/puntuacion|retroalimentacion|reglas|pasos/);
  });
});

describe('Etapa 3 · crear', () => {
  test('201 con código autogenerado y estructura completa', async () => {
    const res = await request(app).post('/api/scenarios').set(auth(admin.token)).send(docSmishing());
    expect(res.status).toBe(201);
    const e = res.body.escenario;
    expect(e.codigo).toMatch(/^SM-\d{3}$/);
    expect(e.pasos).toHaveLength(2);
    expect(e.pasos[0].opciones[0]).toMatchObject({ clave: 'abrir', siguiente_paso: 'web', puntuacion: -10 });
    expect(e.pasos[0].opciones[1].senales).toEqual(['url_rara']);
    expect(e.reglas[0].tipo_regla).toBe('TIPO_ACCION_PRESENTE');
  });

  test('los códigos siguen la secuencia por tipo', async () => {
    const a = await request(app).post('/api/scenarios').set(auth(admin.token)).send(docSmishing({ titulo: 'Otro SMS' }));
    const b = await request(app).post('/api/scenarios').set(auth(admin.token)).send(docSmishing({ titulo: 'Otro SMS más' }));
    const n = (c) => parseInt(c.split('-')[1], 10);
    expect(n(b.body.escenario.codigo)).toBe(n(a.body.escenario.codigo) + 1);
  });

  test('400 por esquema: campos obligatorios, tipo de acción y regla inválidos', async () => {
    const doc = docSmishing({ titulo: '' });
    doc.pasos[0].opciones[0].tipo_accion = 'peligrosa';
    doc.reglas = [{ tipo_regla: 'INVENTADA', descripcion: 'x' }];
    const res = await request(app).post('/api/scenarios').set(auth(admin.token)).send(doc);
    expect(res.status).toBe(400);
    const campos = res.body.error.details.map((d) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['body.titulo', 'body.pasos.0.opciones.0.tipo_accion']));
  });

  test('400 por estructura: ciclos, referencias rotas y tipo desconocido', async () => {
    const ciclo = docSmishing();
    ciclo.pasos[1].opciones[1].siguiente_paso = 'sms';
    const r1 = await request(app).post('/api/scenarios').set(auth(admin.token)).send(ciclo);
    expect(r1.status).toBe(400);
    expect(JSON.stringify(r1.body)).toMatch(/ciclo/);

    const rota = docSmishing({ tipo: 'vishing' });
    rota.reglas = [{ tipo_regla: 'OPCION_SELECCIONADA', parametros: { opcion: 'no_existe' }, descripcion: 'x y' }];
    const r2 = await request(app).post('/api/scenarios').set(auth(admin.token)).send(rota);
    expect(r2.status).toBe(400);
    expect(JSON.stringify(r2.body)).toMatch(/opción inexistente/);
    expect(JSON.stringify(r2.body)).toMatch(/Tipo de ataque desconocido/);
  });
});

describe('Etapa 3 · consultar (admin)', () => {
  test('listado con filtros por tipo y estado, y búsqueda por código', async () => {
    const sm = await request(app).get('/api/scenarios?tipo=smishing').set(auth(admin.token));
    expect(sm.body.datos.length).toBeGreaterThanOrEqual(1);
    expect(sm.body.datos.every((e) => e.tipo === 'smishing')).toBe(true);

    const busq = await request(app).get('/api/scenarios?buscar=PH-001').set(auth(admin.token));
    expect(busq.body.datos.map((e) => e.codigo)).toEqual(['PH-001']);
  });

  test('GET /:id devuelve el documento completo de PH-001 igual al del seed', async () => {
    const { rows } = await pool.query(`SELECT id FROM escenarios WHERE codigo = 'PH-001'`);
    const res = await request(app).get(`/api/scenarios/${rows[0].id}`).set(auth(admin.token));
    expect(res.status).toBe(200);
    const e = res.body.escenario;
    expect(e.pasos.map((p) => p.clave)).toEqual(ph001.pasos.map((p) => p.clave));
    expect(e.pasos[2].opciones.map((o) => o.clave)).toEqual(ph001.pasos[2].opciones.map((o) => o.clave));
    expect(e.senales).toHaveLength(4);
    expect(e.reglas).toHaveLength(3);
  });

  test('404 para id inexistente', async () => {
    expect((await request(app).get('/api/scenarios/999999').set(auth(admin.token))).status).toBe(404);
  });
});

describe('Etapa 3 · actualizar', () => {
  let creado;
  beforeAll(async () => {
    creado = (await request(app).post('/api/scenarios').set(auth(admin.token)).send(docSmishing({ titulo: 'Para editar' }))).body.escenario;
  });

  test('PUT modifica metadatos, opciones y reglas conservando los ids de lo que mantiene su clave', async () => {
    const doc = docSmishing({ titulo: 'Paquete retenido (v2)', dificultad: 'intermedio' });
    doc.pasos[0].opciones[1].puntuacion = 15;
    doc.pasos[0].opciones.push({ clave: 'ignorar', texto: 'Ignorar', tipo_accion: 'neutral', puntuacion: 0, retroalimentacion: 'Ok' });
    doc.pasos[1].opciones = doc.pasos[1].opciones.reverse(); // reordenar
    doc.reglas = [];

    const res = await request(app).put(`/api/scenarios/${creado.id}`).set(auth(admin.token)).send(doc);
    expect(res.status).toBe(200);
    const e = res.body.escenario;
    expect(e).toMatchObject({ titulo: 'Paquete retenido (v2)', dificultad: 'intermedio', codigo: creado.codigo });
    expect(e.pasos[0].opciones).toHaveLength(3);
    expect(e.pasos[0].opciones[1]).toMatchObject({ clave: 'verificar', puntuacion: 15, id: creado.pasos[0].opciones[1].id });
    expect(e.pasos[1].opciones.map((o) => o.clave)).toEqual(['cerrar', 'pagar']);
    expect(e.reglas).toEqual([]);
  });

  test('PUT puede eliminar pasos y mover opciones', async () => {
    const doc = docSmishing({ titulo: 'Solo un paso' });
    doc.pasos = [doc.pasos[0]];
    doc.pasos[0].opciones[0].siguiente_paso = null;
    doc.reglas = [];
    const res = await request(app).put(`/api/scenarios/${creado.id}`).set(auth(admin.token)).send(doc);
    expect(res.status).toBe(200);
    expect(res.body.escenario.pasos).toHaveLength(1);
  });

  test('PATCH cambia el estado; un escenario inactivo no es visible para usuarios', async () => {
    const r = await request(app).patch(`/api/scenarios/${creado.id}`).set(auth(admin.token)).send({ estado: 'inactivo' });
    expect(r.status).toBe(200);
    expect(r.body.escenario.estado).toBe('inactivo');
    expect((await request(app).get(`/api/scenarios/${creado.id}`).set(auth(usuario.token))).status).toBe(404);
    const lista = await request(app).get('/api/scenarios').set(auth(usuario.token));
    expect(lista.body.datos.some((e) => e.id === creado.id)).toBe(false);
  });
});

describe('Etapa 3 · eliminar (lógico)', () => {
  test('204; desaparece del listado pero se conserva en la BD', async () => {
    const e = (await request(app).post('/api/scenarios').set(auth(admin.token)).send(docSmishing({ titulo: 'A eliminar' }))).body.escenario;
    expect((await request(app).delete(`/api/scenarios/${e.id}`).set(auth(admin.token))).status).toBe(204);

    const lista = await request(app).get('/api/scenarios?limite=100').set(auth(admin.token));
    expect(lista.body.datos.some((x) => x.id === e.id)).toBe(false);
    const eliminados = await request(app).get('/api/scenarios?estado=eliminado').set(auth(admin.token));
    expect(eliminados.body.datos.some((x) => x.id === e.id)).toBe(true);

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM escenario_pasos WHERE escenario_id = $1', [e.id]);
    expect(rows[0].n).toBe(2);

    expect((await request(app).delete(`/api/scenarios/${e.id}`).set(auth(admin.token))).status).toBe(404);
    expect((await request(app).put(`/api/scenarios/${e.id}`).set(auth(admin.token)).send(docSmishing())).status).toBe(404);
  });
});
