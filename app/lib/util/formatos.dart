/// Campos de cada formato de contenido simulado. Lo usan el editor de
/// escenarios (para generar el formulario) y la vista de simulación.
library;

enum TipoCampo { texto, multilinea, lista, booleano }

class CampoFormato {
  const CampoFormato(this.clave, this.label, [this.tipo = TipoCampo.texto]);
  final String clave;
  final String label;
  final TipoCampo tipo;
}

class Formato {
  const Formato(this.label, this.campos);
  final String label;
  final List<CampoFormato> campos;
}

const formatos = <String, Formato>{
  'correo': Formato('Correo', [
    CampoFormato('remitente_nombre', 'Nombre visible del remitente'),
    CampoFormato('remitente_correo', 'Correo del remitente'),
    CampoFormato('asunto', 'Asunto'),
    CampoFormato('fecha', 'Fecha/hora mostrada'),
    CampoFormato('cuerpo', 'Cuerpo del mensaje', TipoCampo.multilinea),
    CampoFormato('enlace_texto', 'Texto del enlace o botón'),
    CampoFormato('enlace_url', 'URL del enlace (solo se muestra)'),
  ]),
  'sms': Formato('SMS', [
    CampoFormato('remitente', 'Remitente (número o nombre)'),
    CampoFormato('fecha', 'Fecha/hora mostrada'),
    CampoFormato('mensaje', 'Mensaje', TipoCampo.multilinea),
    CampoFormato('enlace_url', 'URL incluida (solo se muestra)'),
  ]),
  'mensaje_chat': Formato('Chat', [
    CampoFormato('aplicacion', 'Aplicación (p. ej. mensajería)'),
    CampoFormato('remitente', 'Remitente'),
    CampoFormato('mensaje', 'Mensaje', TipoCampo.multilinea),
  ]),
  'sitio_web': Formato('Sitio web', [
    CampoFormato('url', 'Dirección (URL)'),
    CampoFormato('titulo_pagina', 'Título de la página'),
    CampoFormato('mensaje', 'Texto de la página', TipoCampo.multilinea),
    CampoFormato('campos', 'Campos del formulario (separados por comas)', TipoCampo.lista),
  ]),
  'llamada': Formato('Llamada', [
    CampoFormato('llamante', 'Quién dice llamar'),
    CampoFormato('numero', 'Número mostrado'),
    CampoFormato('transcripcion', 'Lo que dice la persona', TipoCampo.multilinea),
  ]),
  'detalle_remitente': Formato('Detalle remitente', [
    CampoFormato('remitente_nombre', 'Nombre visible'),
    CampoFormato('remitente_correo', 'Correo real'),
    CampoFormato('dominio', 'Dominio'),
    CampoFormato('nota', 'Observación', TipoCampo.multilinea),
  ]),
  'detalle_url': Formato('Detalle URL', [
    CampoFormato('url', 'URL completa'),
    CampoFormato('dominio_real', 'Dominio real'),
    CampoFormato('usa_https', '¿Usa HTTPS?', TipoCampo.booleano),
    CampoFormato('nota', 'Observación', TipoCampo.multilinea),
  ]),
  'texto': Formato('Texto', [CampoFormato('texto', 'Texto', TipoCampo.multilinea)]),
};
