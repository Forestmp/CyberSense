const AppError = require('../utils/AppError');

/**
 * Valida body, params y/o query con esquemas zod. Los valores ya limpios y
 * convertidos quedan en req.valid = { body, params, query }.
 */
const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  const detalles = [];
  for (const parte of ['params', 'query', 'body']) {
    if (!schemas[parte]) continue;
    const r = schemas[parte].safeParse(req[parte] ?? {});
    if (r.success) {
      req.valid[parte] = r.data;
    } else {
      for (const issue of r.error.issues) {
        detalles.push({ campo: [parte, ...issue.path].join('.'), mensaje: issue.message });
      }
    }
  }
  if (detalles.length) return next(AppError.badRequest('Datos de entrada inválidos', detalles));
  next();
};

module.exports = validate;
