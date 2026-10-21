/**
 * Plantillas de correo. El correo de recuperación modela buenas prácticas
 * contra el phishing: no lleva enlaces y solo pide escribir el código en la app.
 */
const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function codigoRecuperacion({ nombre, codigo, minutos }) {
  const primerNombre = escapar(nombre.split(' ')[0]);
  const asunto = `Tu código de recuperación de CyberSense: ${codigo}`;
  const texto = [
    `Hola, ${nombre.split(' ')[0]}:`,
    '',
    `Tu código para restablecer la contraseña de CyberSense es: ${codigo}`,
    '',
    `Escríbelo en la app. Vence en ${minutos} minutos y solo funciona una vez.`,
    'Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.',
    '',
    'CyberSense nunca te pedirá tu contraseña ni este código por correo, mensaje o llamada.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px">
        <tr><td style="background:#0B1F4D;border-radius:16px 16px 0 0;padding:20px 24px">
          <span style="font-size:20px;font-weight:800;color:#FFFFFF">Cyber</span><span style="font-size:20px;font-weight:800;color:#2F80FF">Sense</span>
        </td></tr>
        <tr><td style="padding:24px">
          <p style="margin:0 0 12px;font-size:16px">Hola, ${primerNombre}:</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:22px">Usa este código para restablecer tu contraseña en la app:</p>
          <div style="text-align:center;margin:0 0 20px">
            <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:8px;color:#0B1F4D;background:#EAF2FF;border-radius:12px;padding:14px 22px">${codigo}</span>
          </div>
          <p style="margin:0 0 8px;font-size:14px;color:#64748B">Vence en ${minutos} minutos y solo funciona una vez.</p>
          <p style="margin:0 0 20px;font-size:14px;color:#64748B">Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.</p>
          <p style="margin:0;font-size:13px;color:#0B1F4D;background:#EAF2FF;border-radius:10px;padding:12px">
            🛡️ CyberSense nunca te pedirá tu contraseña ni este código por correo, mensaje o llamada. Este correo no contiene enlaces.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { asunto, texto, html };
}

module.exports = { codigoRecuperacion };
