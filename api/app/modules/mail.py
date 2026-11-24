"""
Envío de correos.
  MAIL_PROVIDER=brevo   envía con la API HTTP de Brevo (Render gratuito bloquea SMTP).
  MAIL_PROVIDER=console no envía nada: escribe el correo en los logs (desarrollo y pruebas).
"""
import html
import logging

import httpx

from app.config import settings

log = logging.getLogger('api.mail')

BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

# Los correos enviados en modo consola quedan disponibles para las pruebas.
enviados: list[dict] = []


def _enviar_con_brevo(para: str, nombre: str, asunto: str, html_: str, texto: str):
    res = httpx.post(
        BREVO_URL,
        headers={'api-key': settings.BREVO_API_KEY, 'Accept': 'application/json'},
        json={
            'sender': {'name': settings.MAIL_FROM_NAME, 'email': settings.MAIL_FROM_EMAIL},
            'to': [{'email': para, 'name': nombre}],
            'subject': asunto,
            'htmlContent': html_,
            'textContent': texto,
        },
        timeout=10,
    )
    if res.is_error:
        raise RuntimeError(f'Brevo respondió {res.status_code}: {res.text[:300]}')


def enviar(para: str, nombre: str, asunto: str, html_: str, texto: str):
    if settings.MAIL_PROVIDER == 'brevo':
        return _enviar_con_brevo(para, nombre, asunto, html_, texto)
    enviados.append({'para': para, 'nombre': nombre, 'asunto': asunto, 'html': html_, 'texto': texto})
    if settings.ENV != 'test':
        log.warning('[correo:consola] Para: %s · Asunto: %s\n%s', para, asunto, texto)


def codigo_recuperacion(nombre: str, codigo: str, minutos: int) -> dict:
    """
    Correo de recuperación. Modela buenas prácticas contra el phishing: no lleva
    enlaces y solo pide escribir el código en la app.
    """
    primer_nombre = nombre.split(' ')[0]
    asunto = f'Tu código de recuperación de CyberSense: {codigo}'
    texto = '\n'.join([
        f'Hola, {primer_nombre}:',
        '',
        f'Tu código para restablecer la contraseña de CyberSense es: {codigo}',
        '',
        f'Escríbelo en la app. Vence en {minutos} minutos y solo funciona una vez.',
        'Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.',
        '',
        'CyberSense nunca te pedirá tu contraseña ni este código por correo, mensaje o llamada.',
    ])
    html_ = f'''<!doctype html>
<html lang="es"><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px">
        <tr><td style="background:#0B1F4D;border-radius:16px 16px 0 0;padding:20px 24px">
          <span style="font-size:20px;font-weight:800;color:#FFFFFF">Cyber</span><span style="font-size:20px;font-weight:800;color:#2F80FF">Sense</span>
        </td></tr>
        <tr><td style="padding:24px">
          <p style="margin:0 0 12px;font-size:16px">Hola, {html.escape(primer_nombre)}:</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:22px">Usa este código para restablecer tu contraseña en la app:</p>
          <div style="text-align:center;margin:0 0 20px">
            <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:8px;color:#0B1F4D;background:#EAF2FF;border-radius:12px;padding:14px 22px">{codigo}</span>
          </div>
          <p style="margin:0 0 8px;font-size:14px;color:#64748B">Vence en {minutos} minutos y solo funciona una vez.</p>
          <p style="margin:0 0 20px;font-size:14px;color:#64748B">Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.</p>
          <p style="margin:0;font-size:13px;color:#0B1F4D;background:#EAF2FF;border-radius:10px;padding:12px">
            🛡️ CyberSense nunca te pedirá tu contraseña ni este código por correo, mensaje o llamada. Este correo no contiene enlaces.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>'''
    return {'asunto': asunto, 'texto': texto, 'html_': html_}
