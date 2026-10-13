const request = require('supertest');
const app = require('../src/app');
const { testEnv } = require('./setup/testEnv');

let contador = 0;

/** Registra un usuario nuevo con correo único y devuelve { token, usuario, password }. */
async function registrarUsuario(datos = {}) {
  contador += 1;
  const password = datos.password || 'Segura123';
  const res = await request(app).post('/api/auth/register').send({
    nombre: datos.nombre || `Usuario ${contador}`,
    correo: datos.correo || `usuario${Date.now()}_${contador}@test.local`,
    password,
    confirmar_password: password,
  });
  if (res.status !== 201) throw new Error(`Registro falló: ${JSON.stringify(res.body)}`);
  return { ...res.body, password };
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ correo: testEnv.ADMIN_EMAIL, password: testEnv.ADMIN_PASSWORD });
  if (res.status !== 200) throw new Error(`Login admin falló: ${JSON.stringify(res.body)}`);
  return res.body;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, registrarUsuario, loginAdmin, auth };
