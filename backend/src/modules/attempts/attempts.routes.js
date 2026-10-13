const { Router } = require('express');
const { z } = require('zod');
const validate = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/auth');
const { idParam } = require('../../utils/schemas');
const service = require('./attempts.service');

const router = Router();
router.use(authenticate);

const id = z.coerce.number().int().positive();

router.post('/', validate({ body: z.object({ escenario_id: id }) }), async (req, res) => {
  res.status(201).json(await service.iniciar(req.user.id, req.valid.body.escenario_id));
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json(await service.obtener(req.user, req.valid.params.id));
});

router.post('/:id/responses', validate({ params: idParam, body: z.object({ opcion_id: id }) }), async (req, res) => {
  res.status(201).json(await service.responder(req.user.id, req.valid.params.id, req.valid.body.opcion_id));
});

router.post('/:id/finish', validate({ params: idParam }), async (req, res) => {
  res.json(await service.finalizar(req.user.id, req.valid.params.id));
});

router.post('/:id/abandon', validate({ params: idParam }), async (req, res) => {
  await service.abandonar(req.user.id, req.valid.params.id);
  res.status(204).end();
});

module.exports = router;
