const { Router } = require('express');
const { z } = require('zod');
const { rateLimit } = require('express-rate-limit');
const env = require('../../config/env');
const validate = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/auth');
const { correo, password, nombre } = require('../../utils/schemas');
const service = require('./auth.service');
const recovery = require('./recovery.service');
const users = require('../users/users.repository');

const router = Router();

// Limita intentos de fuerza bruta: 20 peticiones por IP cada 15 minutos.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Intenta de nuevo más tarde.' } },
});

const registerSchema = z
  .object({ nombre, correo, password, confirmar_password: z.string() })
  .refine((d) => d.password === d.confirmar_password, {
    path: ['confirmar_password'],
    message: 'Las contraseñas no coinciden',
  });

const loginSchema = z.object({ correo, password: z.string().min(1, 'La contraseña es obligatoria') });

// Recuperación de contraseña: límite propio, más estricto.
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' } },
});

const forgotSchema = z.object({ correo });
const resetSchema = z
  .object({
    correo,
    codigo: z.string().trim().regex(/^\d{6}$/,'El código tiene 6 dígitos'),
    password,
    confirmar_password: z.string(),
  })
  .refine((d) => d.password === d.confirmar_password, { path: ['confirmar_password'], message: 'Las contraseñas no coinciden' });

router.post('/register', limiter, validate({ body: registerSchema }), async (req, res) => {
  const { nombre: n, correo: c, password: p } = req.valid.body;
  res.status(201).json(await service.register({ nombre: n, correo: c, password: p }));
});

router.post('/login', limiter, validate({ body: loginSchema }), async (req, res) => {
  res.json(await service.login(req.valid.body));
});

router.post('/forgot-password', recoveryLimiter, validate({ body: forgotSchema }), async (req, res) => {
  res.json(await recovery.solicitar(req.valid.body.correo));
});

router.post('/reset-password', recoveryLimiter, validate({ body: resetSchema }), async (req, res) => {
  const { correo: c, codigo, password: p } = req.valid.body;
  res.json(await recovery.restablecer({ correo: c, codigo, password: p }));
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ usuario: await users.findById(req.user.id) });
});

module.exports = router;
