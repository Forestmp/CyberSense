const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive('El id debe ser un entero positivo') });

const correo = z.string().trim().toLowerCase().pipe(z.email('Correo electrónico inválido').max(254));

// bcrypt solo considera los primeros 72 bytes, de ahí el máximo.
const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((v) => Buffer.byteLength(v) <= 72, 'La contraseña es demasiado larga')
  .refine((v) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(v) && /\d/.test(v), 'La contraseña debe incluir letras y números');

const nombre = z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100);

module.exports = { idParam, correo, password, nombre };
