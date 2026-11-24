"""Pruebas unitarias del motor de reglas (función pura, sin BD)."""
import json
from pathlib import Path

import pytest

from app.modules.engine import clasificar, cumple_regla, evaluar, rutas_extremas
from app.modules.scenarios_schemas import EscenarioDoc

PH001 = EscenarioDoc.model_validate(json.loads(
    (Path(__file__).resolve().parent.parent / 'db' / 'seeds' / 'escenarios' / 'PH-001.json').read_text(encoding='utf-8')
)).model_dump()

RANGOS = [
    {'version': 'v0', 'nivel': 'critico', 'nombre': 'Crítico', 'puntaje_min': 0, 'puntaje_max': 39.99, 'recomendacion': 'R-critico'},
    {'version': 'v0', 'nivel': 'alto', 'nombre': 'Alto', 'puntaje_min': 40, 'puntaje_max': 59.99, 'recomendacion': 'R-alto'},
    {'version': 'v0', 'nivel': 'medio', 'nombre': 'Medio', 'puntaje_min': 60, 'puntaje_max': 79.99, 'recomendacion': 'R-medio'},
    {'version': 'v0', 'nivel': 'bajo', 'nombre': 'Bajo', 'puntaje_min': 80, 'puntaje_max': 100, 'recomendacion': 'R-bajo'},
]

OPCIONES = {o['clave']: o for p in PH001['pasos'] for o in p['opciones']}


def respuestas(*claves, tipo=None):
    """Construye respuestas como las guarda la BD a partir de claves de opción; `tipo` fuerza el tipo de acción."""
    return [
        {'orden': i, 'opcion_clave': c, 'texto_opcion': OPCIONES[c]['texto'],
         'tipo_accion': tipo or OPCIONES[c]['tipo_accion']}
        for i, c in enumerate(claves, start=1)
    ]


def evaluar_ruta(*claves):
    return evaluar(escenario=PH001, respuestas=respuestas(*claves), rangos=RANGOS)


# --- Rutas extremas de PH-001 -------------------------------------------------

def test_rutas_extremas():
    r = rutas_extremas(PH001['pasos'])
    assert r['max'] == 25
    assert r['min'] == -40
    assert [x['opcion'] for x in r['mejor_ruta']] == ['revisar_remitente', 'reportar_correo']


# --- Evaluación de recorridos de PH-001 ---------------------------------------

def test_ruta_ideal():
    r = evaluar_ruta('revisar_remitente', 'reportar_correo')
    assert (r['puntaje'], r['puntaje_bruto'], r['aciertos'], r['errores'], r['es_vulnerable']) == (100, 100, 2, 0, False)
    assert r['penalizaciones']['total'] == 0
    assert r['nivel_vulnerabilidad']['nivel'] == 'bajo'
    assert [s['clave'] for s in r['senales']['detectadas']] == ['remitente_sospechoso']
    assert [x['descripcion'] for x in r['reglas_aplicadas']] == ['Reportó el intento de phishing']


def test_abrir_enlace_e_ingresar_datos():
    r = evaluar_ruta('abrir_enlace', 'ingresar_datos')
    assert (r['puntaje'], r['puntaje_bruto'], r['aciertos'], r['errores'], r['es_vulnerable']) == (55, 55, 0, 2, True)
    p = r['penalizaciones']
    assert (p['errores_mayores'], p['errores_menores'], p['total'], p['ajustes_reglas']) == (1, 1, 35, -10)
    assert r['nivel_vulnerabilidad']['nivel'] == 'alto'
    assert [d['opcion'] for d in r['errores_detalle']] == ['Abrir el enlace', 'Introducir la información solicitada']
    assert r['reglas_aplicadas'][0]['descripcion'] == 'Entregó información sensible'
    assert r['reglas_aplicadas'][0]['ajuste'] == -10
    assert r['senales']['detectadas'] == []
    assert 'llama de inmediato a tu banco' in r['recomendaciones'][0]
    assert 'R-alto' in r['recomendaciones']


def test_neutral_no_resta():
    r = evaluar_ruta('ignorar_correo')
    assert r['puntaje'] == 100
    assert r['nivel_vulnerabilidad']['nivel'] == 'bajo'
    assert r['decisiones'][0]['valoracion'] == 'neutral'


def test_mejorable_resta_cinco():
    # RN-04: una decisión mejorable resta 5 puntos y no cuenta como error.
    r = evaluar(escenario=PH001, rangos=RANGOS, respuestas=respuestas('ignorar_correo', tipo='mejorable'))
    assert (r['puntaje'], r['errores'], r['aciertos']) == (95, 0, 0)
    assert (r['penalizaciones']['mejorables'], r['penalizaciones']['total']) == (1, 5)
    assert r['decisiones'][0]['valoracion'] == 'mejorable'
    assert r['errores_detalle'] == []


def test_regla_secuencia():
    r = evaluar_ruta('revisar_remitente', 'abrir_tras_revisar', 'cerrar_pagina')
    assert r['puntaje_bruto'] == 85  # 100 − 10 (error menor) − 5 (regla)
    assert [x['descripcion'] for x in r['reglas_aplicadas']] == ['Detectó el remitente sospechoso pero continuó']
    assert [s['clave'] for s in r['senales']['detectadas']] == ['remitente_sospechoso', 'solicitud_datos_sensibles']
    assert [s['clave'] for s in r['senales']['no_detectadas']] == ['urgencia_amenaza', 'enlace_no_oficial']


def test_retroalimentacion_y_orden():
    r = evaluar_ruta('abrir_enlace', 'revisar_url', 'cerrar_y_reportar')
    assert [d['paso'] for d in r['decisiones']] == ['Nuevo correo en tu bandeja', 'Se abrió una página web', 'Dirección de la página']
    assert 'Revisar la dirección web' in r['decisiones'][1]['retroalimentacion']
    assert [x['opcion'] for x in r['ruta_recomendada']] == [
        'Revisar el remitente', 'Reportar el mensaje como phishing y eliminarlo']


# --- Reglas -------------------------------------------------------------------

RS = respuestas('revisar_remitente', 'abrir_tras_revisar', 'ingresar_datos')


@pytest.mark.parametrize('regla, esperado', [
    ({'tipo_regla': 'OPCION_SELECCIONADA', 'parametros': {'opcion': 'abrir_tras_revisar'}}, True),
    ({'tipo_regla': 'OPCION_SELECCIONADA', 'parametros': {'opcion': 'app_oficial'}}, False),
    ({'tipo_regla': 'TIPO_ACCION_PRESENTE', 'parametros': {'tipo_accion': 'critica'}}, True),
    ({'tipo_regla': 'CONTEO_TIPO_ACCION', 'parametros': {'tipo_accion': 'segura', 'minimo': 1}}, True),
    ({'tipo_regla': 'CONTEO_TIPO_ACCION', 'parametros': {'tipo_accion': 'segura', 'minimo': 2}}, False),
    ({'tipo_regla': 'SECUENCIA', 'parametros': {'opciones': ['revisar_remitente', 'ingresar_datos']}}, True),
    ({'tipo_regla': 'SECUENCIA', 'parametros': {'opciones': ['ingresar_datos', 'revisar_remitente']}}, False),
    ({'tipo_regla': 'DESCONOCIDA', 'parametros': {}}, False),
])
def test_cumple_regla(regla, esperado):
    assert cumple_regla(regla, RS) is esperado


def test_reglas_globales_e_inactivas():
    r = evaluar(escenario=PH001, respuestas=respuestas('abrir_enlace', 'cerrar_pagina'), rangos=RANGOS, reglas_globales=[
        {'tipo_regla': 'TIPO_ACCION_PRESENTE', 'parametros': {'tipo_accion': 'riesgosa'}, 'ajuste_puntuacion': -3, 'descripcion': 'Global'},
        {'tipo_regla': 'TIPO_ACCION_PRESENTE', 'parametros': {'tipo_accion': 'riesgosa'}, 'ajuste_puntuacion': -50,
         'descripcion': 'Inactiva', 'activa': False},
    ])
    assert [x['descripcion'] for x in r['reglas_aplicadas']] == ['Global']
    assert r['puntaje_bruto'] == 87  # 100 − 10 − 3


# --- Penalizaciones RN-03 / RN-04 ---------------------------------------------

def con_ajuste(opcion, ajuste):
    return evaluar(escenario=PH001, rangos=RANGOS, respuestas=respuestas(opcion), reglas_globales=[
        {'tipo_regla': 'OPCION_SELECCIONADA', 'parametros': {'opcion': opcion}, 'ajuste_puntuacion': ajuste, 'descripcion': 'A'},
    ])


def test_puntaje_acotado():
    r = evaluar(escenario=PH001, rangos=RANGOS,
                respuestas=respuestas('revisar_remitente', 'abrir_tras_revisar', 'revisar_url', 'ingresar_tras_revisar'))
    assert (r['penalizaciones']['errores_mayores'], r['penalizaciones']['errores_menores']) == (1, 1)
    assert r['puntaje'] == 100 - 25 - 10 - 10 - 5  # reglas «información sensible» y SECUENCIA
    assert con_ajuste('app_oficial', -150)['puntaje'] == 0
    assert con_ajuste('app_oficial', 20)['puntaje'] == 100


def test_umbral_vulnerable():
    assert con_ajuste('app_oficial', -40)['es_vulnerable'] is False
    assert con_ajuste('app_oficial', -41)['es_vulnerable'] is True


# --- Rangos -------------------------------------------------------------------

def test_clasificar_bordes_y_huecos():
    assert clasificar(80, RANGOS)['nivel'] == 'bajo'
    assert clasificar(79.99, RANGOS)['nivel'] == 'medio'
    assert clasificar(0, RANGOS)['nivel'] == 'critico'
    assert clasificar(79.992, RANGOS)['nivel'] == 'medio'  # hueco: el más cercano
    assert clasificar(79.998, RANGOS)['nivel'] == 'bajo'
    assert clasificar(50, []) is None
