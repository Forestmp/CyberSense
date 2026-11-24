"""
Motor de evaluación basado en reglas deterministas.

Función pura: recibe el escenario (documento con pasos, opciones, señales y
reglas), las reglas globales, las respuestas del intento y los rangos de
vulnerabilidad vigentes, y devuelve el resultado completo. No accede a la BD.

Cálculo (reglas de negocio del documento técnico):
  RN-03  cada error mayor (opción 'critica') resta 25 puntos; cada regla del
         escenario o global que se cumple suma o resta hasta 10 puntos
  RN-04  cada error menor (opción 'riesgosa') resta 10 puntos y cada decisión
         mejorable resta 5; las decisiones seguras y neutrales no restan
  puntaje = 100 − penalizaciones + Σ ajustes de reglas, acotado a [0, 100]
  RN-05  puntaje < 60 ⇒ el escenario se considera «Vulnerable»
  RN-27  nivel de vulnerabilidad = rango activo que contiene al puntaje

La `puntuacion` de cada opción no entra en el puntaje: solo ordena las
opciones para calcular la ruta recomendada que se muestra al final.
"""
import math

VERSION_MOTOR = 'reglas-v3'

PUNTAJE_BASE = 100
PENALIZACION = {'critica': 25, 'riesgosa': 10, 'mejorable': 5}
UMBRAL_VULNERABLE = 60

VALORACION = {'segura': 'correcta', 'neutral': 'neutral', 'mejorable': 'mejorable',
              'riesgosa': 'incorrecta', 'critica': 'incorrecta'}


def _es_error(tipo: str) -> bool:
    return tipo in ('riesgosa', 'critica')


def _redondear(n: float) -> float | int:
    """Dos decimales, redondeando .5 hacia arriba; entero si no tiene decimales."""
    r = math.floor(n * 100 + 0.5) / 100
    return int(r) if r == int(r) else r


def rutas_extremas(pasos: list[dict]) -> dict:
    """
    Mejor y peor puntuación alcanzables recorriendo el grafo desde el paso
    inicial (suma de opciones). El grafo es acíclico (lo garantiza la validación).
    """
    por_clave = {p['clave']: p for p in pasos}
    memo: dict[str, dict] = {}

    def extremos(clave: str) -> dict:
        if clave in memo:
            return memo[clave]
        mejor = peor = None
        for o in por_clave.get(clave, {}).get('opciones', []):
            resto = (extremos(o['siguiente_paso']) if o.get('siguiente_paso')
                     else {'max': {'valor': 0, 'ruta': []}, 'min': {'valor': 0}})
            v_max = o['puntuacion'] + resto['max']['valor']
            v_min = o['puntuacion'] + resto['min']['valor']
            if mejor is None or v_max > mejor['valor']:
                mejor = {'valor': v_max, 'ruta': [{'paso': clave, 'opcion': o['clave']}, *resto['max']['ruta']]}
            if peor is None or v_min < peor['valor']:
                peor = {'valor': v_min}
        r = {'max': mejor or {'valor': 0, 'ruta': []}, 'min': peor or {'valor': 0}}
        memo[clave] = r
        return r

    inicial = next((p for p in pasos if p.get('es_inicial')), None)
    if not inicial:
        return {'max': 0, 'min': 0, 'mejor_ruta': []}
    r = extremos(inicial['clave'])
    return {'max': r['max']['valor'], 'min': r['min']['valor'], 'mejor_ruta': r['max']['ruta']}


def cumple_regla(regla: dict, respuestas: list[dict]) -> bool:
    """¿Se cumple la condición de la regla con las respuestas dadas (en orden)?"""
    p = regla.get('parametros') or {}
    claves = [r['opcion_clave'] for r in respuestas]
    tipo = regla.get('tipo_regla')
    if tipo == 'OPCION_SELECCIONADA':
        return p.get('opcion') in claves
    if tipo == 'TIPO_ACCION_PRESENTE':
        return any(r['tipo_accion'] == p.get('tipo_accion') for r in respuestas)
    if tipo == 'CONTEO_TIPO_ACCION':
        return sum(r['tipo_accion'] == p.get('tipo_accion') for r in respuestas) >= (p.get('minimo') or 1)
    if tipo == 'SECUENCIA':
        # Las opciones aparecen en ese orden (no necesariamente consecutivas).
        opciones = p.get('opciones')
        if not isinstance(opciones, list) or not opciones:
            return False
        i = 0
        for c in claves:
            if i < len(opciones) and c == opciones[i]:
                i += 1
        return i == len(opciones)
    return False


def clasificar(puntaje: float, rangos: list[dict]) -> dict | None:
    """Rango que contiene al puntaje; si cae en un hueco entre rangos, el más cercano."""
    if not rangos:
        return None
    for r in rangos:
        if r['puntaje_min'] <= puntaje <= r['puntaje_max']:
            return r
    return min(rangos, key=lambda r: min(abs(puntaje - r['puntaje_min']), abs(puntaje - r['puntaje_max'])))


def evaluar(escenario: dict, respuestas: list[dict], rangos: list[dict], reglas_globales: list[dict] | None = None) -> dict:
    ordenadas = sorted(respuestas, key=lambda r: r['orden'])

    opcion_por_clave: dict[str, dict] = {}
    paso_por_opcion: dict[str, dict] = {}
    for paso in escenario['pasos']:
        for o in paso['opciones']:
            opcion_por_clave[o['clave']] = o
            paso_por_opcion[o['clave']] = paso

    # 1. Decisiones
    decisiones = []
    for r in ordenadas:
        actual = opcion_por_clave.get(r['opcion_clave'])
        paso = paso_por_opcion.get(r['opcion_clave'])
        decisiones.append({
            'orden': r['orden'],
            'paso': paso['titulo'] if paso else None,
            'opcion': r['texto_opcion'],
            'tipo_accion': r['tipo_accion'],
            'valoracion': VALORACION.get(r['tipo_accion'], 'neutral'),
            'retroalimentacion': actual.get('retroalimentacion') if actual else None,
        })
    aciertos = sum(r['tipo_accion'] == 'segura' for r in ordenadas)
    errores = sum(_es_error(r['tipo_accion']) for r in ordenadas)

    # 2. Reglas
    reglas = [r for r in [*(escenario.get('reglas') or []), *(reglas_globales or [])] if r.get('activa') is not False]
    reglas_aplicadas = [
        {'descripcion': r['descripcion'], 'ajuste': r.get('ajuste_puntuacion') or 0,
         'retroalimentacion': r.get('retroalimentacion') or None}
        for r in reglas if cumple_regla(r, ordenadas)
    ]

    # 3. Puntaje
    errores_mayores = sum(r['tipo_accion'] == 'critica' for r in ordenadas)
    errores_menores = sum(r['tipo_accion'] == 'riesgosa' for r in ordenadas)
    mejorables = sum(r['tipo_accion'] == 'mejorable' for r in ordenadas)
    penalizacion = sum(PENALIZACION.get(r['tipo_accion'], 0) for r in ordenadas)
    suma_ajustes = sum(r['ajuste'] for r in reglas_aplicadas)
    puntaje_bruto = PUNTAJE_BASE - penalizacion + suma_ajustes
    puntaje = _redondear(min(100, max(0, puntaje_bruto)))
    mejor_ruta = rutas_extremas(escenario['pasos'])['mejor_ruta']

    # 4. Vulnerabilidad
    rango = clasificar(puntaje, rangos)

    # 5. Señales de alerta
    claves_detectadas = set()
    for r in ordenadas:
        claves_detectadas.update((opcion_por_clave.get(r['opcion_clave']) or {}).get('senales') or [])
    senales = [{k: s[k] for k in ('clave', 'descripcion', 'explicacion')} for s in escenario.get('senales') or []]

    # 6. Recomendaciones (sin duplicados, de lo más específico a lo general)
    recomendaciones = []
    for t in [*(r['retroalimentacion'] for r in reglas_aplicadas),
              rango.get('recomendacion') if rango else None,
              escenario.get('retroalimentacion_general')]:
        if t and t not in recomendaciones:
            recomendaciones.append(t)

    titulo_paso = {p['clave']: p['titulo'] for p in escenario['pasos']}
    return {
        'version_motor': VERSION_MOTOR,
        'puntaje': puntaje,
        'puntaje_bruto': puntaje_bruto,
        'penalizaciones': {
            'errores_mayores': errores_mayores,
            'errores_menores': errores_menores,
            'mejorables': mejorables,
            'puntos_por_mayor': PENALIZACION['critica'],
            'puntos_por_menor': PENALIZACION['riesgosa'],
            'puntos_por_mejorable': PENALIZACION['mejorable'],
            'total': penalizacion,
            'ajustes_reglas': suma_ajustes,
        },
        'es_vulnerable': puntaje < UMBRAL_VULNERABLE,
        'nivel_vulnerabilidad': (
            {'nivel': rango['nivel'], 'nombre': rango['nombre'], 'descripcion': rango.get('descripcion')}
            if rango else None
        ),
        'version_rangos': rango.get('version') if rango else None,
        'total_decisiones': len(ordenadas),
        'aciertos': aciertos,
        'errores': errores,
        'decisiones': decisiones,
        'errores_detalle': [d for d in decisiones if d['valoracion'] == 'incorrecta'],
        'senales': {
            'total': len(senales),
            'detectadas': [s for s in senales if s['clave'] in claves_detectadas],
            'no_detectadas': [s for s in senales if s['clave'] not in claves_detectadas],
        },
        'reglas_aplicadas': reglas_aplicadas,
        'ruta_recomendada': [
            {'paso': titulo_paso.get(x['paso']), 'opcion': (opcion_por_clave.get(x['opcion']) or {}).get('texto')}
            for x in mejor_ruta
        ],
        'recomendaciones': recomendaciones,
    }
