const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { idParam } = require('../../utils/schemas');
const AppError = require('../../utils/AppError');
const repo = require('./scenarios.repository');
const service = require('./scenarios.service');
const { escenarioDoc, listQuery, patchSchema } = require('./scenarios.schemas');

const router = Router();
router.use(authenticate);

const esAdmin = (req) => req.user.rol === 'admin';

/**
 * Usuarios: solo escenarios activos (resumen, sin opciones ni puntuaciones).
 * Admin: todos salvo eliminados, filtrables por estado.
 */
router.get('/', validate({ query: listQuery }), async (req, res) => {
  res.json(await repo.listar({ ...req.valid.query, soloActivos: !esAdmin(req) }));
});

/**
 * Admin: documento completo (pasos, opciones, puntuaciones, reglas).
 * Usuario: solo el resumen de un escenario activo; los pasos se entregan uno
 * a uno durante el intento para no revelar las respuestas.
 */
router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = req.valid.params;
  if (esAdmin(req)) {
    const doc = await repo.obtenerDocumento(id);
    if (!doc) throw AppError.notFound('Escenario no encontrado');
    return res.json({ escenario: doc });
  }
  const resumen = await repo.obtenerResumen(id);
  if (!resumen || resumen.estado !== 'activo') throw AppError.notFound('Escenario no encontrado');
  res.json({ escenario: resumen });
});

router.post('/', requireRole('admin'), validate({ body: escenarioDoc }), async (req, res) => {
  res.status(201).json({ escenario: await service.crear(req.valid.body, req.user.id) });
});

router.put('/:id', requireRole('admin'), validate({ params: idParam, body: escenarioDoc }), async (req, res) => {
  res.json({ escenario: await service.actualizar(req.valid.params.id, req.valid.body) });
});

// Cambio rápido de estado (activar / desactivar / borrador).
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: patchSchema }), async (req, res) => {
  res.json({ escenario: await service.cambiarEstado(req.valid.params.id, req.valid.body.estado) });
});

router.delete('/:id', requireRole('admin'), validate({ params: idParam }), async (req, res) => {
  await service.eliminar(req.valid.params.id);
  res.status(204).end();
});

module.exports = router;
