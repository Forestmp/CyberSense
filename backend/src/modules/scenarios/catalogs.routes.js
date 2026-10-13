const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth');
const repo = require('./scenarios.repository');
const { TIPOS_ACCION, FORMATOS } = require('./scenarios.schemas');

const router = Router();

/** Catálogos para formularios y filtros de la app. */
router.get('/', authenticate, async (req, res) => {
  res.json({
    ...(await repo.catalogos()),
    tipos_accion: TIPOS_ACCION,
    formatos_contenido: FORMATOS,
    tipos_regla: ['OPCION_SELECCIONADA', 'TIPO_ACCION_PRESENTE', 'CONTEO_TIPO_ACCION', 'SECUENCIA'],
  });
});

module.exports = router;
