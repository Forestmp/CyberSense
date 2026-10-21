const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const users = require('../users/users.repository');

// Hash de relleno: si el correo no existe se compara igualmente para que el
// tiempo de respuesta no revele qué correos están registrados.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-utilizable', env.BCRYPT_ROUNDS);

/** `ver` es la versión de sesión del usuario; si cambia, el token deja de ser válido. */
const firmarToken = (usuario, ver = 0) =>
  jwt.sign({ sub: String(usuario.id), rol: usuario.rol, ver }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const hashPassword = (password) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

async function register({ nombre, correo, password }) {
  if (await users.findByEmailWithHash(correo)) throw AppError.conflict('El correo ya está registrado');
  const usuario = await users.create({ nombre, correo, passwordHash: await hashPassword(password) });
  return { token: firmarToken(usuario), usuario };
}

async function login({ correo, password }) {
  const encontrado = await users.findByEmailWithHash(correo);
  const valida = await bcrypt.compare(password, encontrado?.password_hash ?? HASH_RELLENO);
  if (!encontrado || !valida) throw AppError.unauthorized('Correo o contraseña incorrectos');
  if (encontrado.estado !== 'activo') throw AppError.forbidden('La cuenta no está activa');

  const { password_hash, token_version, ...usuario } = encontrado; // eslint-disable-line no-unused-vars
  return { token: firmarToken(usuario, token_version), usuario };
}

module.exports = { register, login, hashPassword, firmarToken };
