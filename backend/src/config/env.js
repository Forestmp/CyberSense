require('dotenv').config({ quiet: true });
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().optional().default(''),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DB_SSL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  // Número de proxies delante de la API (Render = 1). Necesario para que el
  // límite de intentos use la IP real del cliente.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Correo (recuperación de contraseña)
  MAIL_PROVIDER: z.enum(['console', 'brevo']).default('console'),
  BREVO_API_KEY: z.string().optional(),
  MAIL_FROM_EMAIL: z.string().optional(),
  MAIL_FROM_NAME: z.string().default('CyberSense'),
}).superRefine((d, ctx) => {
  if (d.MAIL_PROVIDER === 'brevo') {
    if (!d.BREVO_API_KEY) ctx.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'Obligatoria con MAIL_PROVIDER=brevo' });
    if (!d.MAIL_FROM_EMAIL) ctx.addIssue({ code: 'custom', path: ['MAIL_FROM_EMAIL'], message: 'Obligatoria con MAIL_PROVIDER=brevo' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Configuración inválida. Revisa tu archivo .env:\n${detalle}`);
  process.exit(1);
}

const env = parsed.data;
env.corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

module.exports = env;
