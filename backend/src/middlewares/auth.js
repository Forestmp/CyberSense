const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../db/pool');
const AppError = require('../utils/AppError');

/**
 * Exige un token Bearer válido. Se consulta al usuario en cada petición para
 * que un cambio de rol o una desactivación surtan efecto de inmediato.
 */
async function authenticate(req, res, next) {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) return next(AppError.unauthorized('Falta el token de autenticación'));

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(AppError.unauthorized('Token inválido o expirado'));
  }

  const { rows } = await query('SELECT id, nombre, correo, rol, estado FROM usuarios WHERE id = $1', [payload.sub]);
  const usuario = rows[0];
  if (!usuario) return next(AppError.unauthorized('Token inválido o expirado'));
  if (usuario.estado !== 'activo') return next(AppError.forbidden('La cuenta no está activa'));

  req.user = usuario;
  next();
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.rol) ? next() : next(AppError.forbidden());

/** Permite el acceso si el :param corresponde al usuario autenticado o si es admin. */
const requireSelfOrAdmin = (param = 'id') => (req, res, next) =>
  req.user.rol === 'admin' || String(req.user.id) === String(req.params[param])
    ? next()
    : next(AppError.forbidden());

module.exports = { authenticate, requireRole, requireSelfOrAdmin };
