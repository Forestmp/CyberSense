/**
 * Motor de evaluación basado en reglas deterministas.
 *
 * Función pura: recibe el escenario (documento con pasos, opciones, señales y
 * reglas), las reglas globales, las respuestas del intento y los rangos de
 * vulnerabilidad vigentes, y devuelve el resultado completo. No accede a la BD.
 *
 * Cálculo (valores provisionales, ver README):
 *   puntaje_bruto = Σ puntuación de las opciones elegidas + Σ ajustes de reglas cumplidas
 *   puntaje (0–100) = (bruto − peor ruta posible) / (mejor ruta − peor ruta) × 100, acotado a [0, 100]
 *   nivel de vulnerabilidad = rango activo que contiene al puntaje
 */

const VERSION_MOTOR = 'reglas-v1';

const VALORACION = { segura: 'correcta', neutral: 'mejorable', riesgosa: 'incorrecta', critica: 'incorrecta' };
const ES_ERROR = (t) => t === 'riesgosa' || t === 'critica';

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Mejor y peor puntuación alcanzables recorriendo el grafo desde el paso
 * inicial (suma de opciones). El grafo es acíclico (lo garantiza la validación).
 */
function rutasExtremas(pasos) {
  const porClave = new Map(pasos.map((p) => [p.clave, p]));
  const memo = new Map();
  const extremos = (clave) => {
    if (memo.has(clave)) return memo.get(clave);
    let max = null;
    let min = null;
    for (const o of porClave.get(clave)?.opciones || []) {
      const resto = o.siguiente_paso ? extremos(o.siguiente_paso) : { max: { valor: 0, ruta: [] }, min: { valor: 0 } };
      const vMax = o.puntuacion + resto.max.valor;
      const vMin = o.puntuacion + resto.min.valor;
      if (!max || vMax > max.valor) max = { valor: vMax, ruta: [{ paso: clave, opcion: o.clave }, ...resto.max.ruta] };
      if (!min || vMin < min.valor) min = { valor: vMin };
    }
    const r = { max: max || { valor: 0, ruta: [] }, min: min || { valor: 0 } };
    memo.set(clave, r);
    return r;
  };
  const inicial = pasos.find((p) => p.es_inicial);
  if (!inicial) return { max: 0, min: 0, mejorRuta: [] };
  const r = extremos(inicial.clave);
  return { max: r.max.valor, min: r.min.valor, mejorRuta: r.max.ruta };
}

/** ¿Se cumple la condición de la regla con las respuestas dadas (en orden)? */
function cumpleRegla(regla, respuestas) {
  const p = regla.parametros || {};
  const claves = respuestas.map((r) => r.opcion_clave);
  switch (regla.tipo_regla) {
    case 'OPCION_SELECCIONADA':
      return claves.includes(p.opcion);
    case 'TIPO_ACCION_PRESENTE':
      return respuestas.some((r) => r.tipo_accion === p.tipo_accion);
    case 'CONTEO_TIPO_ACCION':
      return respuestas.filter((r) => r.tipo_accion === p.tipo_accion).length >= (p.minimo ?? 1);
    case 'SECUENCIA': {
      // Las opciones aparecen en ese orden (no necesariamente consecutivas).
      let i = 0;
      for (const c of claves) if (c === p.opciones?.[i]) i += 1;
      return Array.isArray(p.opciones) && p.opciones.length > 0 && i === p.opciones.length;
    }
    default:
      return false;
  }
}

/** Rango que contiene al puntaje; si cae en un hueco entre rangos, el más cercano. */
function clasificar(puntaje, rangos) {
  if (!rangos.length) return null;
  const dentro = rangos.find((r) => puntaje >= r.puntaje_min && puntaje <= r.puntaje_max);
  if (dentro) return dentro;
  const dist = (r) => Math.min(Math.abs(puntaje - r.puntaje_min), Math.abs(puntaje - r.puntaje_max));
  return [...rangos].sort((a, b) => dist(a) - dist(b))[0];
}

/**
 * @param {object} p
 * @param {object} p.escenario       documento del escenario (pasos, opciones, señales, reglas)
 * @param {object[]} p.reglasGlobales reglas con escenario_id NULL
 * @param {object[]} p.respuestas    [{ orden, opcion_clave, texto_opcion, tipo_accion, puntuacion }]
 * @param {object[]} p.rangos        rangos de vulnerabilidad activos
 */
function evaluar({ escenario, reglasGlobales = [], respuestas, rangos }) {
  const ordenadas = [...respuestas].sort((a, b) => a.orden - b.orden);

  const opcionPorClave = new Map();
  const pasoPorOpcion = new Map();
  for (const paso of escenario.pasos) {
    for (const o of paso.opciones) {
      opcionPorClave.set(o.clave, o);
      pasoPorOpcion.set(o.clave, paso);
    }
  }

  // 1. Decisiones
  const decisiones = ordenadas.map((r) => {
    const actual = opcionPorClave.get(r.opcion_clave);
    return {
      orden: r.orden,
      paso: pasoPorOpcion.get(r.opcion_clave)?.titulo ?? null,
      opcion: r.texto_opcion,
      tipo_accion: r.tipo_accion,
      valoracion: VALORACION[r.tipo_accion] ?? 'mejorable',
      puntuacion: r.puntuacion,
      retroalimentacion: actual?.retroalimentacion ?? null,
    };
  });
  const aciertos = ordenadas.filter((r) => r.tipo_accion === 'segura').length;
  const errores = ordenadas.filter((r) => ES_ERROR(r.tipo_accion)).length;

  // 2. Reglas
  const reglas = [...(escenario.reglas || []), ...reglasGlobales].filter((r) => r.activa !== false);
  const reglasAplicadas = reglas
    .filter((r) => cumpleRegla(r, ordenadas))
    .map((r) => ({ descripcion: r.descripcion, ajuste: r.ajuste_puntuacion || 0, retroalimentacion: r.retroalimentacion || null }));

  // 3. Puntaje
  const sumaOpciones = ordenadas.reduce((s, r) => s + r.puntuacion, 0);
  const sumaAjustes = reglasAplicadas.reduce((s, r) => s + r.ajuste, 0);
  const puntajeBruto = sumaOpciones + sumaAjustes;
  const { max, min, mejorRuta } = rutasExtremas(escenario.pasos);
  const puntaje = max === min ? 100 : redondear(Math.min(100, Math.max(0, ((puntajeBruto - min) / (max - min)) * 100)));

  // 4. Vulnerabilidad
  const rango = clasificar(puntaje, rangos);

  // 5. Señales de alerta
  const clavesDetectadas = new Set();
  for (const r of ordenadas) for (const s of opcionPorClave.get(r.opcion_clave)?.senales || []) clavesDetectadas.add(s);
  const senales = (escenario.senales || []).map(({ clave, descripcion, explicacion }) => ({ clave, descripcion, explicacion }));

  // 6. Recomendaciones (sin duplicados, de lo más específico a lo general)
  const recomendaciones = [...new Set([
    ...reglasAplicadas.map((r) => r.retroalimentacion),
    rango?.recomendacion,
    escenario.retroalimentacion_general,
  ].filter(Boolean))];

  return {
    version_motor: VERSION_MOTOR,
    puntaje,
    puntaje_bruto: puntajeBruto,
    puntaje_min_posible: min,
    puntaje_max_posible: max,
    nivel_vulnerabilidad: rango
      ? { nivel: rango.nivel, nombre: rango.nombre, descripcion: rango.descripcion }
      : null,
    version_rangos: rango?.version ?? null,
    total_decisiones: ordenadas.length,
    aciertos,
    errores,
    decisiones,
    errores_detalle: decisiones.filter((d) => d.valoracion === 'incorrecta'),
    senales: {
      total: senales.length,
      detectadas: senales.filter((s) => clavesDetectadas.has(s.clave)),
      no_detectadas: senales.filter((s) => !clavesDetectadas.has(s.clave)),
    },
    reglas_aplicadas: reglasAplicadas,
    ruta_recomendada: mejorRuta.map(({ paso, opcion }) => ({
      paso: escenario.pasos.find((p) => p.clave === paso)?.titulo,
      opcion: opcionPorClave.get(opcion)?.texto,
    })),
    recomendaciones,
  };
}

module.exports = { evaluar, cumpleRegla, rutasExtremas, clasificar, VERSION_MOTOR };
