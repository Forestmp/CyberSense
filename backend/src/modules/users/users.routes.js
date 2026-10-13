const { Router } = require('express');
const { z } = require('zod');
const bcrypt = require('bcrypt');
const validate = require('../../middlewares/validate');
const { authenticate, requireSelfOrAdmin } = require('../../middlewares/auth');
const { idParam, correo, password, nombre } = require('../../utils/schemas');
const AppError = require('../../utils/AppError');
const users = require('./users.repository');
const { hashPassword } = require('../auth/auth.service');

const router = Router();
router.use(authenticate);

const updateSchema = z
  .object({
    nombre: nombre.optional(),
    correo: correo.optional(),
    password_actual: z.string().optional(),
    password_nueva: password.optional(),
    // Solo administradores:
    rol: z.enum(['usuario', 'admin']).optional(),
    estado: z.enum(['activo', 'inactivo', 'bloqueado']).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para actualizar')
  .refine((d) => !d.password_nueva || d.password_actual, {
    path: ['password_actual'],
    message: 'Para cambiar la contraseña debes enviar la contraseña actual',
  });

router.get('/:id', validate({ params: idParam }), requireSelfOrAdmin(), async (req, res) => {
  const usuario = await users.findById(req.valid.params.id);
  if (!usuario) throw AppError.notFound('Usuario no encontrado');
  res.json({ usuario });
});

router.put('/:id', validate({ params: idParam, body: updateSchema }), requireSelfOrAdmin(), async (req, res) => {
  const { id } = req.valid.params;
  const { password_actual, password_nueva, ...datos } = req.valid.body;
  const esPropio = req.user.id === id;

  if ((datos.rol || datos.estado) && req.user.rol !== 'admin') {
    throw AppError.forbidden('Solo un administrador puede cambiar el rol o el estado');
  }
  // Evita que un administrador se quite el rol o desactive su propia cuenta por accidente.
  if (esPropio && ((datos.rol && datos.rol !== 'admin') || (datos.estado && datos.estado !== 'activo'))) {
    throw AppError.badRequest('No puedes quitarte el rol de administrador ni desactivar tu propia cuenta');
  }

  const actual = await users.findById(id);
  if (!actual) throw AppError.notFound('Usuario no encontrado');

  const cambios = { ...datos };
  if (password_nueva) {
    if (!esPropio) throw AppError.forbidden('Solo el propio usuario puede cambiar su contraseña');
    const ok = await bcrypt.compare(password_actual, await users.getPasswordHash(id));
    if (!ok) throw AppError.badRequest('La contraseña actual es incorrecta');
    cambios.password_hash = await hashPassword(password_nueva);
  }
  if (datos.correo && datos.correo !== actual.correo) {
    const otro = await users.findByEmailWithHash(datos.correo);
    if (otro && otro.id !== id) throw AppError.conflict('El correo ya está registrado');
  }

  res.json({ usuario: await users.update(id, cambios) });
});

module.exports = router;
