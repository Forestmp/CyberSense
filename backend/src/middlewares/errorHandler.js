const AppError = require('../utils/AppError');
const env = require('../config/env');

function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'El cuerpo de la petición no es JSON válido' } });
  }
  // Violaciones de restricciones de PostgreSQL que no se validaron antes.
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'El registro ya existe', details: err.detail } });
  }
  if (err.code === '23503' || err.code === '23514' || err.code === '22P02') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Datos inválidos', details: err.detail } });
  }
  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Error interno del servidor', details: env.NODE_ENV === 'development' ? err.message : undefined },
  });
}

module.exports = { notFoundHandler, errorHandler };
