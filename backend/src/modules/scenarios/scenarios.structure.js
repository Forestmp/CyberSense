/**
 * Reglas de integridad del grafo de un escenario que no se pueden expresar
 * con restricciones de la BD: referencias por clave, paso inicial único,
 * pasos alcanzables y ausencia de ciclos (un intento no puede repetir paso).
 * Recibe el documento con la forma del payload de POST /api/scenarios.
 * Devuelve una lista de mensajes de error (vacía = válido).
 */
function validarEstructura(doc) {
  const errores = [];
  const pasos = doc.pasos || [];
  const clavesPaso = new Set();
  const clavesOpcion = new Set();
  const clavesSenal = new Set((doc.senales || []).map((s) => s.clave));

  if ((doc.senales || []).length !== clavesSenal.size) errores.push('Hay señales de alerta con clave repetida');

  for (const p of pasos) {
    if (clavesPaso.has(p.clave)) errores.push(`Paso con clave repetida: ${p.clave}`);
    clavesPaso.add(p.clave);
  }

  const iniciales = pasos.filter((p) => p.es_inicial);
  if (iniciales.length !== 1) errores.push('El escenario debe tener exactamente un paso inicial');

  for (const p of pasos) {
    if (!p.opciones || p.opciones.length < 2) errores.push(`El paso ${p.clave} debe tener al menos 2 opciones`);
    for (const o of p.opciones || []) {
      if (clavesOpcion.has(o.clave)) errores.push(`Opción con clave repetida en el escenario: ${o.clave}`);
      clavesOpcion.add(o.clave);
      if (o.siguiente_paso != null && !clavesPaso.has(o.siguiente_paso)) {
        errores.push(`La opción ${o.clave} apunta a un paso inexistente: ${o.siguiente_paso}`);
      }
      if (o.siguiente_paso === p.clave) errores.push(`La opción ${o.clave} apunta a su propio paso`);
      for (const s of o.senales || []) {
        if (!clavesSenal.has(s)) errores.push(`La opción ${o.clave} referencia una señal inexistente: ${s}`);
      }
    }
  }

  for (const r of doc.reglas || []) {
    const refs = r.tipo_regla === 'OPCION_SELECCIONADA' ? [r.parametros?.opcion]
      : r.tipo_regla === 'SECUENCIA' ? r.parametros?.opciones || [] : [];
    for (const ref of refs) {
      if (!clavesOpcion.has(ref)) errores.push(`La regla "${r.descripcion}" referencia una opción inexistente: ${ref}`);
    }
  }

  if (errores.length || iniciales.length !== 1) return errores;

  // Recorrido en profundidad desde el paso inicial: detecta ciclos y pasos inalcanzables.
  const porClave = new Map(pasos.map((p) => [p.clave, p]));
  const estado = new Map(); // 1 = en recorrido, 2 = terminado
  const visitar = (clave) => {
    if (estado.get(clave) === 1) return true;
    if (estado.get(clave) === 2) return false;
    estado.set(clave, 1);
    for (const o of porClave.get(clave).opciones) {
      if (o.siguiente_paso != null && visitar(o.siguiente_paso)) return true;
    }
    estado.set(clave, 2);
    return false;
  };
  if (visitar(iniciales[0].clave)) errores.push('Los pasos forman un ciclo; el escenario debe poder terminar siempre');
  for (const p of pasos) {
    if (!estado.has(p.clave)) errores.push(`El paso ${p.clave} no es alcanzable desde el paso inicial`);
  }
  return errores;
}

module.exports = { validarEstructura };
