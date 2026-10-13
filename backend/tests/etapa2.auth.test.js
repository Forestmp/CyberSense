const jwt = require('jsonwebtoken');
const { app, request, registrarUsuario, loginAdmin, auth } = require('./helpers');
const { pool } = require('../src/db/pool');

afterAll(() => pool.end());

describe('Etapa 2 · registro', () => {
  test('201 con token y usuario sin password_hash', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Ana López', correo: 'Ana.Lopez@Test.Local', password: 'Segura123', confirmar_password: 'Segura123',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ nombre: 'Ana López', correo: 'ana.lopez@test.local', rol: 'usuario' });
    expect(res.body.usuario.password_hash).toBeUndefined();

    const { rows } = await pool.query(`SELECT password_hash FROM usuarios WHERE correo = 'ana.lopez@test.local'`);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt, nunca texto plano
  });

  test('409 si el correo ya existe (sin importar mayúsculas)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Otra', correo: 'ANA.LOPEZ@test.local', password: 'Segura123', confirmar_password: 'Segura123',
    });
    expect(res.status).toBe(409);
  });

  test('400 con detalle de cada campo inválido', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'A', correo: 'no-es-correo', password: 'corta', confirmar_password: 'otra',
    });
    expect(res.status).toBe(400);
    const campos = res.body.error.details.map((d) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['body.nombre', 'body.correo', 'body.password']));
  });

  test('400 si las contraseñas no coinciden', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Beto', correo: 'beto@test.local', password: 'Segura123', confirmar_password: 'Segura124',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].campo).toBe('body.confirmar_password');
  });

  test('no permite auto-asignarse rol admin al registrarse', async () => {
    const res = await request(app).post('/api/auth/register').send({
      nombre: 'Intruso', correo: 'intruso@test.local', password: 'Segura123', confirmar_password: 'Segura123', rol: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('usuario');
  });

  test('400 con JSON mal formado', async () => {
    const res = await request(app).post('/api/auth/register').set('Content-Type', 'application/json').send('{"x":');
    expect(res.status).toBe(400);
  });
});

describe('Etapa 2 · inicio de sesión', () => {
  test('200 con credenciales correctas', async () => {
    const res = await request(app).post('/api/auth/login').send({ correo: 'ana.lopez@test.local', password: 'Segura123' });
    expect(res.status).toBe(200);
    expect(res.body.usuario.correo).toBe('ana.lopez@test.local');
    expect(jwt.decode(res.body.token).rol).toBe('usuario');
  });

  test('401 con el mismo mensaje para contraseña incorrecta y correo inexistente', async () => {
    const a = await request(app).post('/api/auth/login').send({ correo: 'ana.lopez@test.local', password: 'Mala1234' });
    const b = await request(app).post('/api/auth/login').send({ correo: 'nadie@test.local', password: 'Mala1234' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  test('403 si la cuenta está inactiva', async () => {
    const u = await registrarUsuario();
    await pool.query(`UPDATE usuarios SET estado = 'inactivo' WHERE id = $1`, [u.usuario.id]);
    const res = await request(app).post('/api/auth/login').send({ correo: u.usuario.correo, password: u.password });
    expect(res.status).toBe(403);
    // Y su token previo deja de servir.
    const me = await request(app).get('/api/auth/me').set(auth(u.token));
    expect(me.status).toBe(403);
  });
});

describe('Etapa 2 · protección de rutas', () => {
  test('401 sin token, con token alterado o expirado', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth('abc.def.ghi'))).status).toBe(401);
    const expirado = jwt.sign({ sub: '1', rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: -10 });
    expect((await request(app).get('/api/auth/me').set(auth(expirado))).status).toBe(401);
    const otroSecreto = jwt.sign({ sub: '1', rol: 'admin' }, 'otro-secreto-cualquiera-de-32-caracteres!!');
    expect((await request(app).get('/api/auth/me').set(auth(otroSecreto))).status).toBe(401);
  });

  test('GET /api/auth/me devuelve al usuario autenticado', async () => {
    const u = await registrarUsuario({ nombre: 'Carla' });
    const res = await request(app).get('/api/auth/me').set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ id: u.usuario.id, nombre: 'Carla' });
  });
});

describe('Etapa 2 · usuarios', () => {
  let u1;
  let u2;
  beforeAll(async () => {
    u1 = await registrarUsuario();
    u2 = await registrarUsuario();
  });

  test('un usuario consulta su perfil, pero no el de otro (403)', async () => {
    expect((await request(app).get(`/api/users/${u1.usuario.id}`).set(auth(u1.token))).status).toBe(200);
    expect((await request(app).get(`/api/users/${u2.usuario.id}`).set(auth(u1.token))).status).toBe(403);
  });

  test('admin consulta cualquier perfil; 404 si no existe; 400 si id inválido', async () => {
    const admin = await loginAdmin();
    expect((await request(app).get(`/api/users/${u2.usuario.id}`).set(auth(admin.token))).status).toBe(200);
    expect((await request(app).get('/api/users/999999').set(auth(admin.token))).status).toBe(404);
    expect((await request(app).get('/api/users/abc').set(auth(admin.token))).status).toBe(400);
  });

  test('PUT actualiza nombre y correo', async () => {
    const res = await request(app).put(`/api/users/${u1.usuario.id}`).set(auth(u1.token))
      .send({ nombre: 'Nombre Nuevo', correo: `nuevo${Date.now()}@test.local` });
    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Nombre Nuevo');
  });

  test('PUT rechaza correo ocupado (409) y campos desconocidos (400)', async () => {
    const r1 = await request(app).put(`/api/users/${u1.usuario.id}`).set(auth(u1.token)).send({ correo: u2.usuario.correo });
    expect(r1.status).toBe(409);
    const r2 = await request(app).put(`/api/users/${u1.usuario.id}`).set(auth(u1.token)).send({ password_hash: 'x' });
    expect(r2.status).toBe(400);
  });

  test('un usuario no puede cambiar su rol (403)', async () => {
    const res = await request(app).put(`/api/users/${u1.usuario.id}`).set(auth(u1.token)).send({ rol: 'admin' });
    expect(res.status).toBe(403);
  });

  test('cambio de contraseña exige la actual correcta', async () => {
    const url = `/api/users/${u2.usuario.id}`;
    const sinActual = await request(app).put(url).set(auth(u2.token)).send({ password_nueva: 'Nueva12345' });
    expect(sinActual.status).toBe(400);
    const mala = await request(app).put(url).set(auth(u2.token)).send({ password_actual: 'Mala1234', password_nueva: 'Nueva12345' });
    expect(mala.status).toBe(400);
    const ok = await request(app).put(url).set(auth(u2.token)).send({ password_actual: u2.password, password_nueva: 'Nueva12345' });
    expect(ok.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ correo: u2.usuario.correo, password: 'Nueva12345' });
    expect(login.status).toBe(200);
  });

  test('admin puede desactivar a un usuario, pero no a sí mismo', async () => {
    const admin = await loginAdmin();
    const otro = await registrarUsuario();
    const r1 = await request(app).put(`/api/users/${otro.usuario.id}`).set(auth(admin.token)).send({ estado: 'inactivo' });
    expect(r1.status).toBe(200);
    expect(r1.body.usuario.estado).toBe('inactivo');
    const r2 = await request(app).put(`/api/users/${admin.usuario.id}`).set(auth(admin.token)).send({ estado: 'inactivo' });
    expect(r2.status).toBe(400);
  });
});
