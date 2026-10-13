const { app, request, registrarUsuario, loginAdmin, auth } = require('./helpers');
const { pool } = require('../src/db/pool');

afterAll(() => pool.end());

let admin;
let normal;
beforeAll(async () => {
  admin = await loginAdmin();
  normal = await registrarUsuario({ nombre: 'Usuario Normal' });
});

describe('CRUD de usuarios · permisos', () => {
  test('un usuario normal no puede listar, crear ni eliminar (403)', async () => {
    expect((await request(app).get('/api/users').set(auth(normal.token))).status).toBe(403);
    expect((await request(app).post('/api/users').set(auth(normal.token))
      .send({ nombre: 'X Y', correo: 'x@test.local', password: 'Segura123' })).status).toBe(403);
    expect((await request(app).delete(`/api/users/${admin.usuario.id}`).set(auth(normal.token))).status).toBe(403);
  });

  test('sin token → 401', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });
});

describe('CRUD de usuarios · crear', () => {
  test('admin crea un usuario con rol; 201 y sin password_hash', async () => {
    const res = await request(app).post('/api/users').set(auth(admin.token))
      .send({ nombre: 'Nuevo Admin', correo: 'Nuevo.Admin@Test.Local', password: 'Segura123', rol: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ correo: 'nuevo.admin@test.local', rol: 'admin', estado: 'activo' });
    expect(res.body.usuario.password_hash).toBeUndefined();
    const login = await request(app).post('/api/auth/login').send({ correo: 'nuevo.admin@test.local', password: 'Segura123' });
    expect(login.status).toBe(200);
  });

  test('409 correo duplicado; 400 datos inválidos o campos extra', async () => {
    const dup = await request(app).post('/api/users').set(auth(admin.token))
      .send({ nombre: 'Dup', correo: 'nuevo.admin@test.local', password: 'Segura123' });
    expect(dup.status).toBe(409);
    const inv = await request(app).post('/api/users').set(auth(admin.token))
      .send({ nombre: 'Z', correo: 'malo', password: '123', rol: 'superadmin' });
    expect(inv.status).toBe(400);
    const extra = await request(app).post('/api/users').set(auth(admin.token))
      .send({ nombre: 'Extra', correo: 'extra@test.local', password: 'Segura123', estado: 'eliminado' });
    expect(extra.status).toBe(400);
  });
});

describe('CRUD de usuarios · listar', () => {
  beforeAll(async () => {
    for (let i = 0; i < 3; i++) await registrarUsuario({ nombre: `Listado Zeta ${i}` });
  });

  test('paginación con total', async () => {
    const res = await request(app).get('/api/users?pagina=1&limite=2').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.datos).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
    expect(res.body).toMatchObject({ pagina: 1, limite: 2 });
    expect(res.body.datos[0]).toHaveProperty('intentos_finalizados');
    expect(res.body.datos[0].password_hash).toBeUndefined();
  });

  test('búsqueda por nombre o correo y filtro por rol', async () => {
    const res = await request(app).get('/api/users?buscar=zeta').set(auth(admin.token));
    expect(res.body.total).toBe(3);
    const admins = await request(app).get('/api/users?rol=admin&limite=100').set(auth(admin.token));
    expect(admins.body.datos.every((u) => u.rol === 'admin')).toBe(true);
  });

  test('la búsqueda trata % y _ como texto literal', async () => {
    const res = await request(app).get('/api/users?buscar=%25').set(auth(admin.token));
    expect(res.body.total).toBe(0);
  });

  test('400 con parámetros inválidos', async () => {
    expect((await request(app).get('/api/users?limite=500').set(auth(admin.token))).status).toBe(400);
    expect((await request(app).get('/api/users?rol=jefe').set(auth(admin.token))).status).toBe(400);
  });
});

describe('CRUD de usuarios · actualizar', () => {
  test('admin restablece la contraseña de otro usuario sin conocer la actual', async () => {
    const u = await registrarUsuario();
    const res = await request(app).put(`/api/users/${u.usuario.id}`).set(auth(admin.token))
      .send({ password_nueva: 'Restablecida99' });
    expect(res.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ correo: u.usuario.correo, password: 'Restablecida99' });
    expect(login.status).toBe(200);
  });

  test('admin cambia rol y estado; no acepta estado "eliminado" por PUT', async () => {
    const u = await registrarUsuario();
    const res = await request(app).put(`/api/users/${u.usuario.id}`).set(auth(admin.token)).send({ rol: 'admin', estado: 'bloqueado' });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ rol: 'admin', estado: 'bloqueado' });
    const del = await request(app).put(`/api/users/${u.usuario.id}`).set(auth(admin.token)).send({ estado: 'eliminado' });
    expect(del.status).toBe(400);
  });
});

describe('CRUD de usuarios · eliminar (lógico)', () => {
  test('204, deja de aparecer en el listado y no puede iniciar sesión; el registro se conserva', async () => {
    const u = await registrarUsuario({ nombre: 'Por Eliminar' });
    const res = await request(app).delete(`/api/users/${u.usuario.id}`).set(auth(admin.token));
    expect(res.status).toBe(204);

    const lista = await request(app).get('/api/users?buscar=Por%20Eliminar').set(auth(admin.token));
    expect(lista.body.total).toBe(0);
    const eliminados = await request(app).get('/api/users?estado=eliminado&buscar=Por%20Eliminar').set(auth(admin.token));
    expect(eliminados.body.total).toBe(1);

    const login = await request(app).post('/api/auth/login').send({ correo: u.usuario.correo, password: u.password });
    expect(login.status).toBe(403);
    expect((await request(app).get('/api/auth/me').set(auth(u.token))).status).toBe(403);

    const { rows } = await pool.query('SELECT estado, fecha_eliminacion FROM usuarios WHERE id = $1', [u.usuario.id]);
    expect(rows[0].estado).toBe('eliminado');
    expect(rows[0].fecha_eliminacion).not.toBeNull();
  });

  test('404 al eliminar dos veces o un id inexistente; 400 al eliminarse a sí mismo', async () => {
    const u = await registrarUsuario();
    await request(app).delete(`/api/users/${u.usuario.id}`).set(auth(admin.token));
    expect((await request(app).delete(`/api/users/${u.usuario.id}`).set(auth(admin.token))).status).toBe(404);
    expect((await request(app).delete('/api/users/999999').set(auth(admin.token))).status).toBe(404);
    expect((await request(app).delete(`/api/users/${admin.usuario.id}`).set(auth(admin.token))).status).toBe(400);
  });

  test('admin puede restaurar un usuario eliminado', async () => {
    const u = await registrarUsuario();
    await request(app).delete(`/api/users/${u.usuario.id}`).set(auth(admin.token));
    const res = await request(app).put(`/api/users/${u.usuario.id}`).set(auth(admin.token)).send({ estado: 'activo' });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ estado: 'activo', fecha_eliminacion: null });
    const login = await request(app).post('/api/auth/login').send({ correo: u.usuario.correo, password: u.password });
    expect(login.status).toBe(200);
  });
});
