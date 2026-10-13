/** Error de aplicación con código HTTP; el middleware de errores lo traduce a JSON. */
class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg, details) { return new AppError(400, msg, { code: 'BAD_REQUEST', details }); }
  static unauthorized(msg = 'No autenticado') { return new AppError(401, msg, { code: 'UNAUTHORIZED' }); }
  static forbidden(msg = 'No tienes permiso para realizar esta acción') { return new AppError(403, msg, { code: 'FORBIDDEN' }); }
  static notFound(msg = 'Recurso no encontrado') { return new AppError(404, msg, { code: 'NOT_FOUND' }); }
  static conflict(msg, details) { return new AppError(409, msg, { code: 'CONFLICT', details }); }
}

module.exports = AppError;
