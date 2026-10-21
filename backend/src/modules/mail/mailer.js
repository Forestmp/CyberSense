/**
 * Envío de correos.
 *   MAIL_PROVIDER=brevo   envía con la API HTTP de Brevo (Render gratuito bloquea SMTP).
 *   MAIL_PROVIDER=console no envía nada: escribe el correo en los logs (desarrollo y pruebas).
 */
const env = require('../../config/env');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function enviarConBrevo({ para, nombre, asunto, html, texto }) {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: env.MAIL_FROM_NAME, email: env.MAIL_FROM_EMAIL },
      to: [{ email: para, name: nombre }],
      subject: asunto,
      htmlContent: html,
      textContent: texto,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Brevo respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }
}

// Los correos enviados en modo consola quedan disponibles para las pruebas.
const enviados = [];

async function enviarPorConsola(mensaje) {
  enviados.push(mensaje);
  if (env.NODE_ENV !== 'test') {
    console.log(`[correo:consola] Para: ${mensaje.para} · Asunto: ${mensaje.asunto}\n${mensaje.texto}`);
  }
}

async function enviar(mensaje) {
  if (env.MAIL_PROVIDER === 'brevo') return enviarConBrevo(mensaje);
  return enviarPorConsola(mensaje);
}

module.exports = { enviar, enviados };
