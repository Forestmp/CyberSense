/**
 * Campos de cada formato de contenido simulado. Lo usan el editor de
 * escenarios (para generar el formulario) y la vista de simulación.
 * tipo: 'texto' (una línea), 'multilinea', 'lista' (separada por comas), 'booleano'
 */
export const FORMATOS = {
  correo: {
    label: 'Correo',
    campos: [
      { clave: 'remitente_nombre', label: 'Nombre visible del remitente' },
      { clave: 'remitente_correo', label: 'Correo del remitente' },
      { clave: 'asunto', label: 'Asunto' },
      { clave: 'fecha', label: 'Fecha/hora mostrada' },
      { clave: 'cuerpo', label: 'Cuerpo del mensaje', tipo: 'multilinea' },
      { clave: 'enlace_texto', label: 'Texto del enlace o botón' },
      { clave: 'enlace_url', label: 'URL del enlace (solo se muestra)' },
    ],
  },
  sms: {
    label: 'SMS',
    campos: [
      { clave: 'remitente', label: 'Remitente (número o nombre)' },
      { clave: 'fecha', label: 'Fecha/hora mostrada' },
      { clave: 'mensaje', label: 'Mensaje', tipo: 'multilinea' },
      { clave: 'enlace_url', label: 'URL incluida (solo se muestra)' },
    ],
  },
  mensaje_chat: {
    label: 'Chat',
    campos: [
      { clave: 'aplicacion', label: 'Aplicación (p. ej. mensajería)' },
      { clave: 'remitente', label: 'Remitente' },
      { clave: 'mensaje', label: 'Mensaje', tipo: 'multilinea' },
    ],
  },
  sitio_web: {
    label: 'Sitio web',
    campos: [
      { clave: 'url', label: 'Dirección (URL)' },
      { clave: 'titulo_pagina', label: 'Título de la página' },
      { clave: 'mensaje', label: 'Texto de la página', tipo: 'multilinea' },
      { clave: 'campos', label: 'Campos del formulario (separados por comas)', tipo: 'lista' },
    ],
  },
  llamada: {
    label: 'Llamada',
    campos: [
      { clave: 'llamante', label: 'Quién dice llamar' },
      { clave: 'numero', label: 'Número mostrado' },
      { clave: 'transcripcion', label: 'Lo que dice la persona', tipo: 'multilinea' },
    ],
  },
  detalle_remitente: {
    label: 'Detalle remitente',
    campos: [
      { clave: 'remitente_nombre', label: 'Nombre visible' },
      { clave: 'remitente_correo', label: 'Correo real' },
      { clave: 'dominio', label: 'Dominio' },
      { clave: 'nota', label: 'Observación', tipo: 'multilinea' },
    ],
  },
  detalle_url: {
    label: 'Detalle URL',
    campos: [
      { clave: 'url', label: 'URL completa' },
      { clave: 'dominio_real', label: 'Dominio real' },
      { clave: 'usa_https', label: '¿Usa HTTPS?', tipo: 'booleano' },
      { clave: 'nota', label: 'Observación', tipo: 'multilinea' },
    ],
  },
  texto: {
    label: 'Texto',
    campos: [{ clave: 'texto', label: 'Texto', tipo: 'multilinea' }],
  },
};
