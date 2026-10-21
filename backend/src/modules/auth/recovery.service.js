/**
 * Recuperación de contraseña con un código de 6 dígitos enviado por correo.
 *
 * - La respuesta de "solicitar" es idéntica exista o no el correo, para no
 *   revelar qué cuentas están registradas.
 * - Se guarda un HMAC del código (nunca el código), vence en 15 minutos,
 *   admite 5 intentos y es de un solo uso.
 * - Al restablecer se incrementa la versión de sesión: se cierran las
 *   sesiones abiertas en otros dispositivos.
 */
const crypto = require('crypto');
const env = require('../../config/env');
const { query, withTransaction } = require('../../db/pool');
const AppError = require('../../utils/AppError');
const mailer = require('../mail/mailer');
const { codigoRecuperacion } = require('../mail/plantillas');
const { hashPassword, firmarToken } = require('./auth.service');
const users = require('../users/users.repository');

const MINUTOS_VIGENCIA = 15;
const MAX_INTENTOS = 5;
const ESPERA_REENVIO_SEG = 60;

const MENSAJE_SOLICITUD = 'Si el correo está registrado, te enviamos un código de 6 dígitos. Revisa también tu carpeta de spam.';

const hmac = (codigo) => crypto.createHmac('sha256', env.JWT_SECRET).update(codigo).digest('hex');
const iguales = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function solicitar(correo) {
  const { rows: [usuario] } = await query(
    `SELECT id, nombre, correo FROM usuarios WHERE lower(correo) = lower($1) AND estado = 'activo'`, [correo]
  );
  if (!usuario) return { mensaje: MENSAJE_SOLICITUD };

  // Evita reenvíos seguidos (y el abuso del servicio de correo).
  const { rows: [reciente] } = await query(
    `SELECT 1 FROM recuperaciones_password
      WHERE usuario_id = $1 AND usado_en IS NULL AND creado_en > now() - make_interval(secs => $2)`,
    [usuario.id, ESPERA_REENVIO_SEG]
  );
  if (reciente) return { mensaje: MENSAJE_SOLICITUD };

  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await withTransaction(async (client) => {
    // Solo vale el código más reciente.
    await client.query(`UPDATE recuperaciones_password SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL`, [usuario.id]);
    await client.query(
      `INSERT INTO recuperaciones_password (usuario_id, codigo_hash, expira_en)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [usuario.id, hmac(codigo), MINUTOS_VIGENCIA]
    );
  });

  try {
    await mailer.enviar({ para: usuario.correo, nombre: usuario.nombre, ...codigoRecuperacion({ nombre: usuario.nombre, codigo, minutos: MINUTOS_VIGENCIA }) });
  } catch (err) {
    // No se revela el fallo al cliente (sería revelar que la cuenta existe); queda en los logs.
    console.error(`No se pudo enviar el código de recuperación al usuario ${usuario.id}: ${err.message}`);
  }
  return { mensaje: MENSAJE_SOLICITUD };
}

async function restablecer({ correo, codigo, password }) {
  const invalido = () => AppError.badRequest('El código es incorrecto o ya venció. Solicita uno nuevo.');

  const resultado = await withTransaction(async (client) => {
    const { rows: [usuario] } = await client.query(
      `SELECT id, nombre, correo, rol, estado FROM usuarios WHERE lower(correo) = lower($1) AND estado = 'activo'`, [correo]
    );
    if (!usuario) throw invalido();

    const { rows: [rec] } = await client.query(
      `SELECT id, codigo_hash, intentos FROM recuperaciones_password
        WHERE usuario_id = $1 AND usado_en IS NULL AND expira_en > now()
        ORDER BY creado_en DESC LIMIT 1 FOR UPDATE`,
      [usuario.id]
    );
    if (!rec || rec.intentos >= MAX_INTENTOS) throw invalido();

    if (!iguales(hmac(codigo), rec.codigo_hash)) {
      const intentos = rec.intentos + 1;
      const agotado = intentos >= MAX_INTENTOS;
      await client.query(
        `UPDATE recuperaciones_password SET intentos = $2, usado_en = CASE WHEN $3::boolean THEN now() END WHERE id = $1`,
        [rec.id, intentos, agotado]
      );
      // Se devuelve (no se lanza) para que el intento quede guardado; lanzar haría ROLLBACK.
      return { error: intentos >= MAX_INTENTOS
        ? 'Demasiados intentos con este código. Solicita uno nuevo.'
        : `El código es incorrecto. Te quedan ${MAX_INTENTOS - intentos} intento(s).` };
    }

    await client.query(`UPDATE recuperaciones_password SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL`, [usuario.id]);
    const { rows: [{ token_version: version }] } = await client.query(
      `UPDATE usuarios SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING token_version`,
      [usuario.id, await hashPassword(password)]
    );
    return { usuario, version };
  });

  // El intento fallido ya quedó guardado (la transacción terminó con COMMIT).
  if (resultado.error) throw AppError.badRequest(resultado.error);
  // Se inicia sesión directamente con la contraseña nueva.
  return { token: firmarToken(resultado.usuario, resultado.version), usuario: await users.findById(resultado.usuario.id) };
}

module.exports = { solicitar, restablecer, MENSAJE_SOLICITUD, MAX_INTENTOS };
