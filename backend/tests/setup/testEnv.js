// Variables de entorno para las pruebas: PostgreSQL embebido y local, nunca Supabase.
const PORT = 54329;

const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: `postgresql://postgres:postgres@localhost:${PORT}/tt_test`,
  DB_SSL: 'false',
  JWT_SECRET: 'secreto-solo-para-pruebas-automatizadas-0123456789',
  BCRYPT_ROUNDS: '4',
  ADMIN_NAME: 'Admin Pruebas',
  ADMIN_EMAIL: 'admin@test.local',
  ADMIN_PASSWORD: 'AdminPrueba123',
};

module.exports = { PORT, testEnv };
