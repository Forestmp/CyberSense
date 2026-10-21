const { app, request, registrarUsuario, loginAdmin, auth } = require('./helpers');
const { pool } = require('../src/db/pool');
const mailer = require('../src/modules/mail/mailer');
const { MENSAJE_SOLICITUD } = require('../src/modules/auth/recovery.service');

afterAll(() => pool.end());

const solicitar = (correo) => request(app).post('/api/auth/forgot-password').send({ correo });
const restablecer = (datos) => request(app).post('/api/auth/reset-password').send({
  password: 'NuevaClave77', confirmar_password: 'NuevaClave77', ...datos,
});
/** Código del último correo enviado a esa dirección (modo consola). */
const ultimoCodigo = (correo) => {
  const msg = [...mailer.enviados].reverse().find((m) => m.para === correo);
  return msg?.texto.match(/\b(\d{6})\b/)?.[1];
};
// Permite solicitar otro código sin esperar los 60 s de reenvío.
const saltarEspera = (usuarioId) => pool.query(
  `UPDATE recuperaciones_password SET creado_en = creado_en - interval '2 minutes' WHERE usuario_id = $1`, [usuarioId]
);

describe('Recuperación · solicitar código', () => {
  test('correo registrado: 200, envía un código de 6 dígitos y guarda solo su hash', async () => {
    const u = await registrarUsuario();
    const res = await solicitar(u.usuario.correo);
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe(MENSAJE_SOLICITUD);

    const codigo = ultimoCodigo(u.usuario.correo);
    expect(codigo).toMatch(/^\d{6}$/);
    const msg = mailer.enviados.at(-1);
    expect(msg.asunto).toContain(codigo);
    expect(msg.html).not.toMatch(/href=/i); // el correo no trae enlaces

    const { rows } = await pool.query('SELECT codigo_hash, expira_en FROM recuperaciones_password WHERE usuario_id = $1', [u.usuario.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo_hash).not.toContain(codigo);
    const minutos = (new Date(rows[0].expira_en) - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);
  });

  test('correo no registrado: misma respuesta y no envía nada', async () => {
    const antes = mailer.enviados.length;
    const res = await solicitar('nadie.registrado@test.local');
    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBe(MENSAJE_SOLICITUD);
    expect(mailer.enviados.length).toBe(antes);
  });

  test('no reenvía si se pidió otro código hace menos de 60 s', async () => {
    const u = await registrarUsuario();
    await solicitar(u.usuario.correo);
    const antes = mailer.enviados.length;
    const res = await solicitar(u.usuario.correo);
    expect(res.status).toBe(200);
    expect(mailer.enviados.length).toBe(antes);
  });

  test('cuenta inactiva: no envía código', async () => {
    const u = await registrarUsuario();
    await pool.query(`UPDATE usuarios SET estado = 'inactivo' WHERE id = $1`, [u.usuario.id]);
    const antes = mailer.enviados.length;
    expect((await solicitar(u.usuario.correo)).status).toBe(200);
    expect(mailer.enviados.length).toBe(antes);
  });

  test('400 con correo inválido', async () => {
    expect((await solicitar('no-es-correo')).status).toBe(400);
  });
});

describe('Recuperación · restablecer contraseña', () => {
  test('código correcto: cambia la contraseña, inicia sesión e invalida sesiones anteriores', async () => {
    const u = await registrarUsuario();
    await solicitar(u.usuario.correo);
    const codigo = ultimoCodigo(u.usuario.correo);

    const res = await restablecer({ correo: u.usuario.correo, codigo });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ id: u.usuario.id, correo: u.usuario.correo });
    expect(res.body.usuario.fecha_registro).toBeTruthy();

    // La contraseña nueva funciona y la anterior no.
    expect((await request(app).post('/api/auth/login').send({ correo: u.usuario.correo, password: 'NuevaClave77' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ correo: u.usuario.correo, password: u.password })).status).toBe(401);
    // El token de antes ya no sirve; el nuevo sí.
    expect((await request(app).get('/api/auth/me').set(auth(u.token))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth(res.body.token))).status).toBe(200);
  });

  test('el código es de un solo uso', async () => {
    const u = await registrarUsuario();
    await solicitar(u.usuario.correo);
    const codigo = ultimoCodigo(u.usuario.correo);
    expect((await restablecer({ correo: u.usuario.correo, codigo })).status).toBe(200);
    expect((await restablecer({ correo: u.usuario.correo, codigo, password: 'OtraClave88', confirmar_password: 'OtraClave88' })).status).toBe(400);
  });

  test('código incorrecto descuenta intentos y al quinto se invalida', async () => {
    const u = await registrarUsuario();
    await solicitar(u.usuario.correo);
    const codigo = ultimoCodigo(u.usuario.correo);
    const malo = codigo === '000000' ? '111111' : '000000';

    const r1 = await restablecer({ correo: u.usuario.correo, codigo: malo });
    expect(r1.status).toBe(400);
    expect(r1.body.error.message).toMatch(/quedan 4 intento/);
    for (let i = 0; i < 3; i++) await restablecer({ correo: u.usuario.correo, codigo: malo });
    const r5 = await restablecer({ correo: u.usuario.correo, codigo: malo });
    expect(r5.body.error.message).toMatch(/Demasiados intentos/);
    // Ni siquiera el código correcto funciona ya.
    expect((await restablecer({ correo: u.usuario.correo, codigo })).status).toBe(400);
  });

  test('código vencido → 400', async () => {
    const u = await registrarUsuario();
    await solicitar(u.usuario.correo);
    const codigo = ultimoCodigo(u.usuario.correo);
    await pool.query(`UPDATE recuperaciones_password SET expira_en = now() - interval '1 minute' WHERE usuario_id = $1`, [u.usuario.id]);
    const res = await restablecer({ correo: u.usuario.correo, codigo });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/venció/);
  });

  test('al pedir un código nuevo, el anterior deja de valer', async () => {
    const u = await registrarUsuario();
    await solicitar(u.usuario.correo);
    const viejo = ultimoCodigo(u.usuario.correo);
    await saltarEspera(u.usuario.id);
    await solicitar(u.usuario.correo);
    const nuevo = ultimoCodigo(u.usuario.correo);
    if (viejo !== nuevo) expect((await restablecer({ correo: u.usuario.correo, codigo: viejo })).status).toBe(400);
    expect((await restablecer({ correo: u.usuario.correo, codigo: nuevo })).status).toBe(200);
  });

  test('validaciones: formato del código, contraseña débil y confirmación', async () => {
    const base = { correo: 'x@test.local' };
    expect((await restablecer({ ...base, codigo: '12ab56' })).status).toBe(400);
    expect((await restablecer({ ...base, codigo: '123456', password: 'corta', confirmar_password: 'corta' })).status).toBe(400);
    const r = await restablecer({ ...base, codigo: '123456', confirmar_password: 'Distinta99' });
    expect(r.status).toBe(400);
    expect(r.body.error.details[0].campo).toBe('body.confirmar_password');
  });

  test('correo sin código pendiente → 400 genérico', async () => {
    const r = await restablecer({ correo: 'nadie.registrado@test.local', codigo: '123456' });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/incorrecto o ya venció/);
  });
});

describe('Versión de sesión en otros cambios de contraseña', () => {
  test('cambiar la contraseña desde el perfil devuelve un token nuevo y anula el anterior', async () => {
    const u = await registrarUsuario();
    const res = await request(app).put(`/api/users/${u.usuario.id}`).set(auth(u.token))
      .send({ password_actual: u.password, password_nueva: 'Cambiada123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect((await request(app).get('/api/auth/me').set(auth(u.token))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth(res.body.token))).status).toBe(200);
  });

  test('si el admin restablece la contraseña, se cierran las sesiones del usuario', async () => {
    const admin = await loginAdmin();
    const u = await registrarUsuario();
    await request(app).put(`/api/users/${u.usuario.id}`).set(auth(admin.token)).send({ password_nueva: 'PorAdmin123' });
    expect((await request(app).get('/api/auth/me').set(auth(u.token))).status).toBe(401);
    // El token del admin sigue válido.
    expect((await request(app).get('/api/auth/me').set(auth(admin.token))).status).toBe(200);
  });

  test('cambiar solo el nombre no invalida la sesión', async () => {
    const u = await registrarUsuario();
    await request(app).put(`/api/users/${u.usuario.id}`).set(auth(u.token)).send({ nombre: 'Otro Nombre' });
    expect((await request(app).get('/api/auth/me').set(auth(u.token))).status).toBe(200);
  });
});
