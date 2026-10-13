/** Pruebas unitarias del motor de reglas (función pura, sin BD). */
const { evaluar, cumpleRegla, rutasExtremas, clasificar } = require('../src/modules/evaluation/engine');
const { escenarioDoc } = require('../src/modules/scenarios/scenarios.schemas');
const ph001 = escenarioDoc.parse(require('../db/seeds/escenarios/PH-001.json'));

const rangos = [
  { version: 'v0', nivel: 'critico', nombre: 'Crítico', puntaje_min: 0, puntaje_max: 39.99, recomendacion: 'R-critico' },
  { version: 'v0', nivel: 'alto', nombre: 'Alto', puntaje_min: 40, puntaje_max: 59.99, recomendacion: 'R-alto' },
  { version: 'v0', nivel: 'medio', nombre: 'Medio', puntaje_min: 60, puntaje_max: 79.99, recomendacion: 'R-medio' },
  { version: 'v0', nivel: 'bajo', nombre: 'Bajo', puntaje_min: 80, puntaje_max: 100, recomendacion: 'R-bajo' },
];

const opciones = new Map(ph001.pasos.flatMap((p) => p.opciones).map((o) => [o.clave, o]));
/** Construye respuestas como las guarda la BD a partir de claves de opción. */
const respuestas = (...claves) => claves.map((c, i) => {
  const o = opciones.get(c);
  return { orden: i + 1, opcion_clave: c, texto_opcion: o.texto, tipo_accion: o.tipo_accion, puntuacion: o.puntuacion };
});
const evaluarRuta = (...claves) => evaluar({ escenario: ph001, respuestas: respuestas(...claves), rangos });

describe('Motor · rutas extremas de PH-001', () => {
  test('mejor ruta = 25 (revisar remitente → reportar), peor = −40 (abrir → ingresar datos)', () => {
    const r = rutasExtremas(ph001.pasos);
    expect(r.max).toBe(25);
    expect(r.min).toBe(-40);
    expect(r.mejorRuta.map((x) => x.opcion)).toEqual(['revisar_remitente', 'reportar_correo']);
  });
});

describe('Motor · evaluación de recorridos de PH-001', () => {
  test('ruta ideal → 100, vulnerabilidad baja, sin errores', () => {
    const r = evaluarRuta('revisar_remitente', 'reportar_correo');
    expect(r).toMatchObject({ puntaje: 100, puntaje_bruto: 25, aciertos: 2, errores: 0 });
    expect(r.nivel_vulnerabilidad.nivel).toBe('bajo');
    expect(r.senales.detectadas.map((s) => s.clave)).toEqual(['remitente_sospechoso']);
    expect(r.reglas_aplicadas.map((x) => x.descripcion)).toEqual(['Reportó el intento de phishing']);
  });

  test('abrir enlace → ingresar datos → 0, crítico, 2 errores, regla de información sensible', () => {
    const r = evaluarRuta('abrir_enlace', 'ingresar_datos');
    expect(r).toMatchObject({ puntaje: 0, puntaje_bruto: -50, aciertos: 0, errores: 2 });
    expect(r.nivel_vulnerabilidad.nivel).toBe('critico');
    expect(r.errores_detalle.map((d) => d.opcion)).toEqual(['Abrir el enlace', 'Introducir la información solicitada']);
    expect(r.reglas_aplicadas[0]).toMatchObject({ descripcion: 'Entregó información sensible', ajuste: -10 });
    expect(r.senales.detectadas).toEqual([]);
    expect(r.recomendaciones[0]).toMatch(/llama de inmediato a tu banco/);
    expect(r.recomendaciones).toContain('R-critico');
  });

  test('ignorar el mensaje → 69.23, medio, decisión "mejorable"', () => {
    const r = evaluarRuta('ignorar_correo');
    expect(r.puntaje).toBe(69.23);
    expect(r.nivel_vulnerabilidad.nivel).toBe('medio');
    expect(r.decisiones[0].valoracion).toBe('mejorable');
  });

  test('detectar el remitente y abrir de todos modos aplica la regla SECUENCIA', () => {
    const r = evaluarRuta('revisar_remitente', 'abrir_tras_revisar', 'cerrar_pagina');
    expect(r.puntaje_bruto).toBe(0);
    expect(r.puntaje).toBe(61.54);
    expect(r.reglas_aplicadas.map((x) => x.descripcion)).toEqual(['Detectó el remitente sospechoso pero continuó']);
    expect(r.senales.detectadas.map((s) => s.clave)).toEqual(['remitente_sospechoso', 'solicitud_datos_sensibles']);
    expect(r.senales.no_detectadas.map((s) => s.clave)).toEqual(['urgencia_amenaza', 'enlace_no_oficial']);
  });

  test('la retroalimentación sale del escenario y las decisiones conservan su orden', () => {
    const r = evaluarRuta('abrir_enlace', 'revisar_url', 'cerrar_y_reportar');
    expect(r.decisiones.map((d) => d.paso)).toEqual(['Nuevo correo en tu bandeja', 'Se abrió una página web', 'Dirección de la página']);
    expect(r.decisiones[1].retroalimentacion).toMatch(/Revisar la dirección web/);
    expect(r.ruta_recomendada.map((x) => x.opcion)).toEqual(['Revisar el remitente', 'Reportar el mensaje como phishing y eliminarlo']);
  });
});

describe('Motor · reglas', () => {
  const rs = respuestas('revisar_remitente', 'abrir_tras_revisar', 'ingresar_datos');
  test.each([
    [{ tipo_regla: 'OPCION_SELECCIONADA', parametros: { opcion: 'abrir_tras_revisar' } }, true],
    [{ tipo_regla: 'OPCION_SELECCIONADA', parametros: { opcion: 'app_oficial' } }, false],
    [{ tipo_regla: 'TIPO_ACCION_PRESENTE', parametros: { tipo_accion: 'critica' } }, true],
    [{ tipo_regla: 'CONTEO_TIPO_ACCION', parametros: { tipo_accion: 'segura', minimo: 1 } }, true],
    [{ tipo_regla: 'CONTEO_TIPO_ACCION', parametros: { tipo_accion: 'segura', minimo: 2 } }, false],
    [{ tipo_regla: 'SECUENCIA', parametros: { opciones: ['revisar_remitente', 'ingresar_datos'] } }, true],
    [{ tipo_regla: 'SECUENCIA', parametros: { opciones: ['ingresar_datos', 'revisar_remitente'] } }, false],
    [{ tipo_regla: 'DESCONOCIDA', parametros: {} }, false],
  ])('%j → %s', (regla, esperado) => {
    expect(cumpleRegla(regla, rs)).toBe(esperado);
  });

  test('las reglas globales se aplican y las inactivas se ignoran', () => {
    const r = evaluar({
      escenario: ph001,
      respuestas: respuestas('abrir_enlace', 'cerrar_pagina'),
      rangos,
      reglasGlobales: [
        { tipo_regla: 'TIPO_ACCION_PRESENTE', parametros: { tipo_accion: 'riesgosa' }, ajuste_puntuacion: -3, descripcion: 'Global' },
        { tipo_regla: 'TIPO_ACCION_PRESENTE', parametros: { tipo_accion: 'riesgosa' }, ajuste_puntuacion: -50, descripcion: 'Inactiva', activa: false },
      ],
    });
    expect(r.reglas_aplicadas.map((x) => x.descripcion)).toEqual(['Global']);
    expect(r.puntaje_bruto).toBe(-3);
  });
});

describe('Motor · rangos', () => {
  test('clasifica en bordes y en huecos entre rangos', () => {
    expect(clasificar(80, rangos).nivel).toBe('bajo');
    expect(clasificar(79.99, rangos).nivel).toBe('medio');
    expect(clasificar(0, rangos).nivel).toBe('critico');
    expect(clasificar(79.992, rangos).nivel).toBe('medio'); // hueco: el más cercano
    expect(clasificar(79.998, rangos).nivel).toBe('bajo');
    expect(clasificar(50, [])).toBeNull();
  });
});
