const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const validate = require('../../middlewares/validate');
const { authenticate, requireRole, requireSelfOrAdmin } = require('../../middlewares/auth');
const { idParam, correo, password, nombre } = require('../../utils/schemas');
const AppError = require('../../utils/AppError');
const users = require('./users.repository');
const { hashPassword } = require('../auth/auth.service');
const metrics = require('../metrics/metrics.repository');

const router = Router();
router.use(authenticate);

const rol = z.enum(['usuario', 'admin']);
// 'eliminado' solo se asigna con DELETE.
const estadoEditable = z.enum(['activo', 'inactivo', 'bloqueado']);

const listSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  buscar: z.string().trim().max(100).optional(),
  rol: rol.optional(),
  estado: z.enum(['activo', 'inactivo', 'bloqueado', 'eliminado']).optional(),
});

const createSchema = z
  .object({ nombre, correo, password, rol: rol.default('usuario'), estado: estadoEditable.default('activo') })
  .strict();

const updateSchema = z
  .object({
    nombre: nombre.optional(),
    correo: correo.optional(),
    password_actual: z.string().optional(),
    password_nueva: password.optional(),
    // Solo administradores:
    rol: rol.optional(),
    estado: estadoEditable.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para actualizar');

async function asegurarCorreoLibre(correoNuevo, idActual = null) {
  const otro = await users.findByEmailWithHash(correoNuevo);
  if (otro && otro.id !== idActual) throw AppError.conflict('El correo ya está registrado');
}

// --- Administración (solo admin) -------------------------------------------

router.get('/', requireRole('admin'), validate({ query: listSchema }), async (req, res) => {
  res.json(await users.list(req.valid.query));
});

router.post('/', requireRole('admin'), validate({ body: createSchema }), async (req, res) => {
  const { password: pwd, ...datos } = req.valid.body;
  await asegurarCorreoLibre(datos.correo);
  const usuario = await users.create({ ...datos, passwordHash: await hashPassword(pwd) });
  res.status(201).json({ usuario });
});

router.delete('/:id', requireRole('admin'), validate({ params: idParam }), async (req, res) => {
  const { id } = req.valid.params;
  if (id === req.user.id) throw AppError.badRequest('No puedes eliminar tu propia cuenta');
  const usuario = await users.findById(id);
  if (!usuario || usuario.estado === 'eliminado') throw AppError.notFound('Usuario no encontrado');
  await users.softDelete(id);
  res.status(204).end();
});

// --- Historial y métricas (propio usuario o admin) -------------------------

const historyQuery = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  tipo: z.string().regex(/^[a-z_]{2,40}$/).optional(),
});

router.get('/:id/history', validate({ params: idParam, query: historyQuery }), requireSelfOrAdmin(), async (req, res) => {
  if (!(await users.findById(req.valid.params.id))) throw AppError.notFound('Usuario no encontrado');
  res.json(await metrics.historial(req.valid.params.id, req.valid.query));
});

router.get('/:id/metrics', validate({ params: idParam }), requireSelfOrAdmin(), async (req, res) => {
  if (!(await users.findById(req.valid.params.id))) throw AppError.notFound('Usuario no encontrado');
  res.json(await metrics.metricas(req.valid.params.id));
});

// --- Perfil (propio usuario o admin) ---------------------------------------

router.get('/:id', validate({ params: idParam }), requireSelfOrAdmin(), async (req, res) => {
  const usuario = await users.findById(req.valid.params.id);
  if (!usuario) throw AppError.notFound('Usuario no encontrado');
  res.json({ usuario });
});

router.put('/:id', validate({ params: idParam, body: updateSchema }), requireSelfOrAdmin(), async (req, res) => {
  const { id } = req.valid.params;
  const { password_actual, password_nueva, ...datos } = req.valid.body;
  const esPropio = req.user.id === id;
  const esAdmin = req.user.rol === 'admin';

  if ((datos.rol || datos.estado) && !esAdmin) {
    throw AppError.forbidden('Solo un administrador puede cambiar el rol o el estado');
  }
  // Evita que un administrador se quite el rol o desactive su propia cuenta por accidente.
  if (esPropio && ((datos.rol && datos.rol !== 'admin') || (datos.estado && datos.estado !== 'activo'))) {
    throw AppError.badRequest('No puedes quitarte el rol de administrador ni desactivar tu propia cuenta');
  }

  const actual = await users.findById(id);
  if (!actual) throw AppError.notFound('Usuario no encontrado');

  const cambios = { ...datos };
  if (actual.estado === 'eliminado' && datos.estado) cambios.fecha_eliminacion = null; // restauración

  if (password_nueva) {
    // El propio usuario debe confirmar su contraseña actual; un admin puede
    // restablecer la de otra persona sin conocerla.
    if (esPropio) {
      if (!password_actual) throw AppError.badRequest('Para cambiar la contraseña debes enviar la contraseña actual');
      const ok = await bcrypt.compare(password_actual, await users.getPasswordHash(id));
      if (!ok) throw AppError.badRequest('La contraseña actual es incorrecta');
    }
    cambios.password_hash = await hashPassword(password_nueva);
  }
  if (datos.correo && datos.correo !== actual.correo) await asegurarCorreoLibre(datos.correo, id);

  res.json({ usuario: await users.update(id, cambios) });
});

module.exports = router;
