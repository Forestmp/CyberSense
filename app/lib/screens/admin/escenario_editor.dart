import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';
import '../../util/etiquetas.dart';
import '../../util/formatos.dart';
import '../../widgets/avisos.dart';
import '../../widgets/ui.dart';

/*
 * Editor de escenarios (crear y editar). El estado local tiene la misma forma
 * que el documento de la API (referencias por clave); `_k` es solo una llave
 * para los widgets. Números y listas se guardan como texto mientras se editan.
 */

int _contador = 0;
String _k() => 'k${++_contador}';

Json _clonar(Object? x) => jsonDecode(jsonEncode(x)) as Json;

Json _nuevaOpcion(String clave) => {
      '_k': _k(), 'clave': clave, 'texto': '', 'tipo_accion': 'neutral', 'puntuacion': '0',
      'retroalimentacion': '', 'siguiente_paso': null, 'senales': <String>[],
    };

Json _nuevoPaso(String clave, bool inicial) => {
      '_k': _k(), 'clave': clave, 'titulo': '', 'pregunta': '¿Qué haces?', 'es_inicial': inicial,
      'contenido': <String, dynamic>{'formato': 'correo'},
      'opciones': [_nuevaOpcion('${clave}_op1'), _nuevaOpcion('${clave}_op2')],
    };

Json _nuevaRegla() => {
      '_k': _k(), 'tipo_regla': 'TIPO_ACCION_PRESENTE', 'parametros': <String, dynamic>{'tipo_accion': 'critica'},
      'ajuste_puntuacion': '0', 'descripcion': '', 'retroalimentacion': '', 'activa': true,
    };

Json _vacio() => {
      'titulo': '', 'tipo': 'phishing', 'subcategoria': '', 'dificultad': 'basico', 'descripcion': '', 'contexto': '',
      'retroalimentacion_general': '', 'estado': 'borrador', 'senales': <Json>[],
      'pasos': [_nuevoPaso('paso_1', true)], 'reglas': <Json>[],
    };

/// Documento de la API → estado del editor.
Json _aEstado(Json e) => {
      'titulo': e['titulo'], 'tipo': e['tipo'], 'subcategoria': e['subcategoria'], 'dificultad': e['dificultad'],
      'descripcion': e['descripcion'],
      'contexto': (e['contenido'] as Json?)?['contexto'] ?? '',
      'retroalimentacion_general': e['retroalimentacion_general'] ?? '',
      'estado': e['estado'] == 'eliminado' ? 'inactivo' : e['estado'],
      'senales': [
        for (final s in (e['senales'] as List).cast<Json>())
          {'_k': _k(), 'clave': s['clave'], 'descripcion': s['descripcion'], 'explicacion': s['explicacion']},
      ],
      'pasos': [
        for (final p in (e['pasos'] as List).cast<Json>())
          {
            '_k': _k(), 'clave': p['clave'], 'titulo': p['titulo'], 'pregunta': p['pregunta'], 'es_inicial': p['es_inicial'],
            'contenido': <String, dynamic>{
              for (final c in (p['contenido'] as Json).entries) c.key: c.value is List ? (c.value as List).join(', ') : c.value,
            },
            'opciones': [
              for (final o in (p['opciones'] as List).cast<Json>())
                {
                  '_k': _k(), 'clave': o['clave'], 'texto': o['texto'], 'tipo_accion': o['tipo_accion'],
                  'puntuacion': '${o['puntuacion']}', 'retroalimentacion': o['retroalimentacion'],
                  'siguiente_paso': o['siguiente_paso'], 'senales': (o['senales'] as List).cast<String>().toList(),
                },
            ],
          },
      ],
      'reglas': [
        for (final r in (e['reglas'] as List).cast<Json>())
          {
            '_k': _k(), 'tipo_regla': r['tipo_regla'],
            'parametros': switch (r['tipo_regla']) {
              'SECUENCIA' => <String, dynamic>{'opciones': ((r['parametros']['opciones'] as List?) ?? []).join(', ')},
              'CONTEO_TIPO_ACCION' => <String, dynamic>{...r['parametros'] as Json, 'minimo': '${r['parametros']['minimo']}'},
              _ => Map<String, dynamic>.from(r['parametros'] as Json),
            },
            'ajuste_puntuacion': '${r['ajuste_puntuacion']}', 'descripcion': r['descripcion'],
            'retroalimentacion': r['retroalimentacion'] ?? '', 'activa': r['activa'],
          },
      ],
    };

List<String> _lista(Object? v) => '${v ?? ''}'.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty).toList();

/// Estado del editor → payload de la API. Devuelve (payload, errores).
(Json, List<String>) _aPayload(Json d) {
  final errores = <String>[if ('${d['subcategoria']}'.isEmpty) 'Elige la subcategoría del escenario'];
  int entero(Object? v, String donde) {
    final n = int.tryParse('${v ?? ''}'.trim());
    if (n == null) errores.add('$donde: debe ser un número entero');
    return n ?? 0;
  }

  final payload = <String, dynamic>{
    'titulo': d['titulo'], 'subcategoria': d['subcategoria'], 'dificultad': d['dificultad'], 'descripcion': d['descripcion'],
    'estado': d['estado'],
    'contenido': '${d['contexto']}'.trim().isNotEmpty ? {'contexto': '${d['contexto']}'.trim()} : <String, dynamic>{},
    'retroalimentacion_general':
        '${d['retroalimentacion_general']}'.trim().isEmpty ? null : '${d['retroalimentacion_general']}'.trim(),
    'senales': [
      for (final s in (d['senales'] as List).cast<Json>()) {for (final e in s.entries) if (e.key != '_k') e.key: e.value},
    ],
    'pasos': [
      for (final p in (d['pasos'] as List).cast<Json>())
        {
          'clave': p['clave'], 'titulo': p['titulo'], 'pregunta': p['pregunta'], 'es_inicial': p['es_inicial'],
          'contenido': () {
            final c = p['contenido'] as Json;
            final contenido = <String, dynamic>{'formato': c['formato']};
            for (final campo in formatos[c['formato']]?.campos ?? const <CampoFormato>[]) {
              final v = c[campo.clave];
              if (campo.tipo == TipoCampo.booleano) {
                if (v is bool) contenido[campo.clave] = v;
                continue;
              }
              if (v == null || '$v'.trim().isEmpty) continue;
              contenido[campo.clave] = campo.tipo == TipoCampo.lista ? _lista(v) : '$v';
            }
            return contenido;
          }(),
          'opciones': [
            for (final o in (p['opciones'] as List).cast<Json>())
              {
                'clave': o['clave'], 'texto': o['texto'], 'tipo_accion': o['tipo_accion'],
                'retroalimentacion': o['retroalimentacion'],
                'puntuacion': entero(o['puntuacion'], 'Puntuación de «${'${o['texto']}'.isEmpty ? o['clave'] : o['texto']}»'),
                'siguiente_paso': o['siguiente_paso'], 'senales': o['senales'],
              },
          ],
        },
    ],
    'reglas': [
      for (final r in (d['reglas'] as List).cast<Json>())
        {
          'tipo_regla': r['tipo_regla'],
          'parametros': switch (r['tipo_regla']) {
            'SECUENCIA' => {'opciones': _lista(r['parametros']['opciones'])},
            'CONTEO_TIPO_ACCION' => {
                'tipo_accion': r['parametros']['tipo_accion'],
                'minimo': entero(r['parametros']['minimo'], 'Mínimo de «${r['descripcion']}»'),
              },
            _ => r['parametros'],
          },
          'descripcion': r['descripcion'], 'activa': r['activa'],
          'ajuste_puntuacion': entero(r['ajuste_puntuacion'],
              'Ajuste de «${'${r['descripcion']}'.isEmpty ? r['tipo_regla'] : r['descripcion']}»'),
          'retroalimentacion': '${r['retroalimentacion']}'.trim().isEmpty ? null : '${r['retroalimentacion']}'.trim(),
        },
    ],
  };
  return (payload, errores);
}

final _tipoAccionOpts = [for (final e in tiposAccion.entries) (e.key, e.value.label)];
const _tiposRegla = [
  ('TIPO_ACCION_PRESENTE', 'Tipo de acción presente'),
  ('CONTEO_TIPO_ACCION', 'Conteo de acciones'),
  ('OPCION_SELECCIONADA', 'Opción elegida'),
  ('SECUENCIA', 'Secuencia'),
];
const _paramsIniciales = {
  'TIPO_ACCION_PRESENTE': {'tipo_accion': 'critica'},
  'CONTEO_TIPO_ACCION': {'tipo_accion': 'riesgosa', 'minimo': '2'},
  'OPCION_SELECCIONADA': {'opcion': ''},
  'SECUENCIA': {'opciones': ''},
};

class EditorEscenario extends StatefulWidget {
  const EditorEscenario({super.key, this.escenarioId});
  final int? escenarioId;

  @override
  State<EditorEscenario> createState() => _EditorEscenarioState();
}

class _EditorEscenarioState extends State<EditorEscenario> {
  late final bool _esNuevo = widget.escenarioId == null;
  final _scroll = ScrollController();
  Json? _doc;
  Json? _catalogos;
  List<String> _errores = [];
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    if (_esNuevo) _doc = _vacio();
    _cargar();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _cargar() async {
    try {
      final cat = await Api.get('/catalogos') as Json;
      final doc = _esNuevo ? _doc : _aEstado((await Api.get('/scenarios/${widget.escenarioId}'))['escenario'] as Json);
      if (mounted) {
        setState(() {
          _catalogos = cat;
          _doc = doc;
        });
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _errores = [e.message]);
    }
  }

  /// Aplica una modificación al documento y redibuja.
  void _upd(void Function(Json d) fn) => setState(() => fn(_doc!));

  List<Json> get _senales => (_doc!['senales'] as List).cast<Json>();
  List<Json> get _pasos => (_doc!['pasos'] as List).cast<Json>();
  List<Json> get _reglas => (_doc!['reglas'] as List).cast<Json>();
  List<Json> _opcionesDe(Json p) => (p['opciones'] as List).cast<Json>();
  List<Json> get _todasLasOpciones => [for (final p in _pasos) ..._opcionesDe(p)];

  String _claveUnica(String base, List<Object?> existentes) {
    var n = existentes.length + 1;
    while (existentes.contains('${base}_$n')) {
      n++;
    }
    return '${base}_$n';
  }

  // Renombrar una clave actualiza las referencias que dependen de ella.
  void _renombrarPaso(Json paso, String nueva) => _upd((d) {
        final vieja = paso['clave'];
        paso['clave'] = nueva;
        for (final o in _todasLasOpciones) {
          if (o['siguiente_paso'] == vieja) o['siguiente_paso'] = nueva;
        }
      });

  void _renombrarSenal(Json senal, String nueva) => _upd((d) {
        final vieja = senal['clave'];
        senal['clave'] = nueva;
        for (final o in _todasLasOpciones) {
          o['senales'] = [for (final s in o['senales'] as List) s == vieja ? nueva : s];
        }
      });

  void _renombrarOpcion(Json opcion, String nueva) => _upd((d) {
        final vieja = opcion['clave'];
        opcion['clave'] = nueva;
        for (final r in _reglas) {
          if (r['tipo_regla'] == 'OPCION_SELECCIONADA' && r['parametros']['opcion'] == vieja) {
            r['parametros']['opcion'] = nueva;
          }
        }
      });

  void _irArriba() => _scroll.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);

  Future<void> _guardar() async {
    final (payload, locales) = _aPayload(_doc!);
    if (locales.isNotEmpty) {
      setState(() => _errores = locales);
      _irArriba();
      return;
    }
    setState(() {
      _errores = [];
      _guardando = true;
    });
    try {
      final r = _esNuevo
          ? await Api.post('/scenarios', payload)
          : await Api.put('/scenarios/${widget.escenarioId}', payload);
      final escenario = r['escenario'] as Json;
      avisoExito('Escenario guardado correctamente (${escenario['codigo']})');
      if (!mounted) return;
      if (_esNuevo) {
        context.pushReplacement('/admin/escenarios/${escenario['id']}');
      } else {
        context.pop();
      }
    } on ApiError catch (e) {
      final detalle = e.details is List
          ? [
              for (final x in (e.details as List).cast<Map>())
                x['campo'] != null && x['campo'] != 'body'
                    ? '${'${x['campo']}'.replaceFirst(RegExp(r'^body\.'), '')}: ${x['mensaje']}'
                    : '${x['mensaje']}',
            ]
          : <String>[];
      setState(() => _errores = [e.message, ...detalle]);
      _irArriba();
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_esNuevo ? 'Nuevo escenario' : 'Editar escenario')),
      body: SafeArea(top: false, child: _cuerpo()),
      bottomNavigationBar: _doc == null || _catalogos == null
          ? null
          : Container(
              decoration: const BoxDecoration(
                color: C.surface,
                border: Border(top: BorderSide(color: C.border)),
                boxShadow: Sombra.lg,
              ),
              padding: const EdgeInsets.all(12),
              child: SafeArea(
                top: false,
                child: Center(
                  heightFactor: 1,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Row(children: [
                      Expanded(child: Boton('Cancelar', variante: VarianteBoton.ghost, onPressed: () => context.pop())),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: Boton(_esNuevo ? 'Crear escenario' : 'Guardar cambios',
                            icono: Icons.save_outlined, cargando: _guardando, onPressed: _guardar),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _listaErrores() => _errores.isEmpty
      ? const SizedBox.shrink()
      : Aviso(tono: Tono.error, titulo: _errores.first, children: [
          for (final m in _errores.skip(1)) Text('• $m', style: T.small.copyWith(color: const Color(0xFF7F1D1D))),
        ]);

  Widget _cuerpo() {
    if (_doc == null || _catalogos == null) {
      return _errores.isNotEmpty
          ? EstadoError(mensaje: 'No fue posible cargar el escenario. ${_errores.first}', onRetry: () => context.pop())
          : const Cargando();
    }
    final d = _doc!;
    final cat = _catalogos!;

    return SingleChildScrollView(
      controller: _scroll,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Col(gap: 16, children: [
              _listaErrores(),

              // ---------- Datos generales ----------
              const Aviso(mensaje: 'Todo el contenido debe ser ficticio: usa instituciones, dominios y números inventados.'),
              const _Encabezado('Datos generales', icono: Icons.description_outlined),
              Tarjeta(
                child: Col(gap: 12, children: [
                  Campo(etiqueta: 'Título', valor: '${d['titulo']}', onChanged: (v) => _upd((d) => d['titulo'] = v)),
                  Segmentado<String>(
                    etiqueta: 'Tipo de ataque',
                    valor: '${d['tipo']}',
                    opciones: [for (final t in (cat['tipos_ataque'] as List).cast<Json>()) ('${t['clave']}', '${t['nombre']}')],
                    onChanged: (v) => _upd((d) => d
                      ..['tipo'] = v
                      ..['subcategoria'] = ''),
                  ),
                  Segmentado<String>(
                    etiqueta: 'Subcategoría',
                    valor: '${d['subcategoria']}',
                    opciones: [
                      for (final s in (cat['subcategorias'] as List).cast<Json>())
                        if (s['tipo'] == d['tipo']) ('${s['clave']}', '${s['nombre']}'),
                    ],
                    onChanged: (v) => _upd((d) => d['subcategoria'] = v),
                  ),
                  Segmentado<String>(
                    etiqueta: 'Dificultad',
                    valor: '${d['dificultad']}',
                    opciones: [for (final t in (cat['dificultades'] as List).cast<Json>()) ('${t['clave']}', '${t['nombre']}')],
                    onChanged: (v) => _upd((d) => d['dificultad'] = v),
                  ),
                  Campo(
                      etiqueta: 'Descripción (la ve el usuario)',
                      multilinea: true,
                      valor: '${d['descripcion']}',
                      onChanged: (v) => _upd((d) => d['descripcion'] = v)),
                  Campo(
                      etiqueta: 'Contexto de la situación',
                      multilinea: true,
                      valor: '${d['contexto']}',
                      ayuda: 'Se muestra antes de comenzar. Usa nombres de instituciones ficticias.',
                      onChanged: (v) => _upd((d) => d['contexto'] = v)),
                  Campo(
                      etiqueta: 'Retroalimentación general',
                      multilinea: true,
                      valor: '${d['retroalimentacion_general']}',
                      ayuda: 'Se muestra al final como recomendación.',
                      onChanged: (v) => _upd((d) => d['retroalimentacion_general'] = v)),
                  Segmentado<String>(
                    etiqueta: 'Estado',
                    valor: '${d['estado']}',
                    opciones: const [('borrador', 'Borrador'), ('activo', 'Activo'), ('inactivo', 'Inactivo')],
                    onChanged: (v) => _upd((d) => d['estado'] = v),
                  ),
                ]),
              ),

              // ---------- Señales de alerta ----------
              _Encabezado('Señales de alerta (${_senales.length})',
                  icono: Icons.flag_outlined,
                  accion: Boton('+ Señal',
                      tamano: TamanoBoton.sm,
                      variante: VarianteBoton.secondary,
                      onPressed: () => _upd((d) => _senales.add({
                            '_k': _k(),
                            'clave': _claveUnica('senal', [for (final s in _senales) s['clave']]),
                            'descripcion': '',
                            'explicacion': '',
                          })))),
              for (final s in _senales) _tarjetaSenal(s),

              // ---------- Pasos ----------
              _Encabezado('Pasos y opciones (${_pasos.length})',
                  icono: Icons.account_tree_outlined,
                  accion: Boton('+ Paso',
                      tamano: TamanoBoton.sm,
                      variante: VarianteBoton.secondary,
                      onPressed: () => _upd((d) => _pasos.add(
                          _nuevoPaso(_claveUnica('paso', [for (final p in _pasos) p['clave']]), _pasos.isEmpty))))),
              for (final (i, p) in _pasos.indexed) _tarjetaPaso(i, p),

              // ---------- Reglas ----------
              _Encabezado('Reglas de evaluación (${_reglas.length})',
                  icono: Icons.tune,
                  accion: Boton('+ Regla',
                      tamano: TamanoBoton.sm,
                      variante: VarianteBoton.secondary,
                      onPressed: () => _upd((d) => _reglas.add(_nuevaRegla())))),
              for (final r in _reglas) _tarjetaRegla(r),

              _listaErrores(),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _tarjetaSenal(Json s) => Tarjeta(
        key: ValueKey(s['_k']),
        child: Col(gap: 12, children: [
          Campo(
              etiqueta: 'Clave',
              valor: '${s['clave']}',
              mayusculas: TextCapitalization.none,
              onChanged: (v) => _renombrarSenal(s, v)),
          Campo(etiqueta: 'Descripción', valor: '${s['descripcion']}', onChanged: (v) => _upd((_) => s['descripcion'] = v)),
          Campo(
              etiqueta: 'Explicación (al final)',
              multilinea: true,
              valor: '${s['explicacion']}',
              onChanged: (v) => _upd((_) => s['explicacion'] = v)),
          Boton('Quitar señal',
              tamano: TamanoBoton.sm,
              variante: VarianteBoton.danger,
              onPressed: () => _upd((d) {
                    _senales.remove(s);
                    for (final o in _todasLasOpciones) {
                      o['senales'] = [for (final x in o['senales'] as List) if (x != s['clave']) x];
                    }
                  })),
        ]),
      );

  Widget _tarjetaPaso(int pi, Json p) {
    final contenido = p['contenido'] as Json;
    final formato = formatos['${contenido['formato']}'] ?? formatos['texto']!;
    final opciones = _opcionesDe(p);
    return Tarjeta(
      key: ValueKey(p['_k']),
      borde: p['es_inicial'] == true ? const BorderSide(color: C.primary, width: 2) : null,
      child: Col(gap: 12, children: [
        Row(children: [
          Expanded(child: Text('PASO ${pi + 1}${p['es_inicial'] == true ? ' · INICIAL' : ''}', style: T.overline)),
          if (p['es_inicial'] != true)
            Flexible(
              child: Boton('Marcar inicial',
                  tamano: TamanoBoton.sm,
                  variante: VarianteBoton.ghost,
                  onPressed: () => _upd((d) {
                        for (final x in _pasos) {
                          x['es_inicial'] = identical(x, p);
                        }
                      })),
            ),
        ]),
        Campo(
            etiqueta: 'Clave',
            valor: '${p['clave']}',
            mayusculas: TextCapitalization.none,
            onChanged: (v) => _renombrarPaso(p, v)),
        Campo(etiqueta: 'Título', valor: '${p['titulo']}', onChanged: (v) => _upd((_) => p['titulo'] = v)),
        Segmentado<String>(
          etiqueta: 'Formato del contenido',
          valor: '${contenido['formato']}',
          opciones: [for (final f in formatos.entries) (f.key, f.value.label)],
          onChanged: (v) => _upd((_) => contenido['formato'] = v),
        ),
        for (final campo in formato.campos)
          campo.tipo == TipoCampo.booleano
              ? Segmentado<bool?>(
                  key: ValueKey('${p['_k']}_${campo.clave}'),
                  etiqueta: campo.label,
                  valor: contenido[campo.clave] as bool?,
                  opciones: const [(true, 'Sí'), (false, 'No')],
                  onChanged: (v) => _upd((_) => contenido[campo.clave] = v),
                )
              : Campo(
                  key: ValueKey('${p['_k']}_${campo.clave}'),
                  etiqueta: campo.label,
                  multilinea: campo.tipo == TipoCampo.multilinea,
                  mayusculas: TextCapitalization.none,
                  valor: '${contenido[campo.clave] ?? ''}',
                  onChanged: (v) => _upd((_) => contenido[campo.clave] = v),
                ),
        Campo(etiqueta: 'Pregunta', valor: '${p['pregunta']}', onChanged: (v) => _upd((_) => p['pregunta'] = v)),
        for (final (oi, o) in opciones.indexed) _bloqueOpcion(p, oi, o),
        Boton('+ Opción',
            tamano: TamanoBoton.sm,
            variante: VarianteBoton.secondary,
            onPressed: () => _upd((_) => opciones.add(
                _nuevaOpcion(_claveUnica('${p['clave']}_op', [for (final x in _todasLasOpciones) x['clave']]))))),
        if (_pasos.length > 1)
          Boton('Quitar paso',
              tamano: TamanoBoton.sm,
              variante: VarianteBoton.danger,
              onPressed: () => _upd((d) {
                    final clave = p['clave'];
                    final eraInicial = p['es_inicial'] == true;
                    _pasos.remove(p);
                    for (final o in _todasLasOpciones) {
                      if (o['siguiente_paso'] == clave) o['siguiente_paso'] = null;
                    }
                    if (eraInicial) _pasos.first['es_inicial'] = true;
                  })),
      ]),
    );
  }

  Widget _bloqueOpcion(Json p, int oi, Json o) {
    final t = tiposAccion[o['tipo_accion']] ?? tiposAccion['neutral']!;
    final opciones = _opcionesDe(p);
    final senales = (o['senales'] as List).cast<String>();
    return Container(
      key: ValueKey(o['_k']),
      padding: const EdgeInsets.only(left: 12, top: 8, bottom: 8),
      decoration: BoxDecoration(border: Border(left: BorderSide(color: t.fg, width: 3))),
      child: Col(gap: 12, children: [
        Text('OPCIÓN ${oi + 1}', style: T.overline),
        Campo(etiqueta: 'Texto', valor: '${o['texto']}', onChanged: (v) => _upd((_) => o['texto'] = v)),
        Campo(
            etiqueta: 'Clave',
            valor: '${o['clave']}',
            mayusculas: TextCapitalization.none,
            onChanged: (v) => _renombrarOpcion(o, v)),
        Segmentado<String>(
          etiqueta: 'Tipo de acción',
          valor: '${o['tipo_accion']}',
          opciones: _tipoAccionOpts,
          onChanged: (v) => _upd((_) => o['tipo_accion'] = v),
        ),
        Campo(
            etiqueta: 'Puntuación',
            valor: '${o['puntuacion']}',
            teclado: const TextInputType.numberWithOptions(signed: true),
            ayuda: 'Positiva = segura; negativa = riesgosa',
            onChanged: (v) => _upd((_) => o['puntuacion'] = v)),
        Campo(
            etiqueta: 'Retroalimentación (al final)',
            multilinea: true,
            valor: '${o['retroalimentacion']}',
            onChanged: (v) => _upd((_) => o['retroalimentacion'] = v)),
        Segmentado<String?>(
          etiqueta: 'Después de elegirla',
          valor: o['siguiente_paso'] as String?,
          opciones: [
            (null, 'Termina'),
            for (final x in _pasos)
              if (!identical(x, p)) ('${x['clave']}', '→ ${'${x['titulo']}'.isEmpty ? x['clave'] : x['titulo']}'),
          ],
          onChanged: (v) => _upd((_) => o['siguiente_paso'] = v),
        ),
        if (_senales.isNotEmpty)
          Col(gap: 6, children: [
            Text('Señales que identifica', style: T.label),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final s in _senales)
                Boton(
                  '${senales.contains(s['clave']) ? '✓ ' : ''}${'${s['descripcion']}'.isEmpty ? s['clave'] : s['descripcion']}',
                  tamano: TamanoBoton.sm,
                  variante: senales.contains(s['clave']) ? VarianteBoton.primary : VarianteBoton.secondary,
                  onPressed: () => _upd((_) {
                    o['senales'] = senales.contains(s['clave'])
                        ? [for (final x in senales) if (x != s['clave']) x]
                        : [...senales, '${s['clave']}'];
                  }),
                ),
            ]),
          ]),
        if (opciones.length > 2)
          Boton('Quitar opción', tamano: TamanoBoton.sm, variante: VarianteBoton.ghost, onPressed: () => _upd((_) => opciones.remove(o))),
      ]),
    );
  }

  Widget _tarjetaRegla(Json r) {
    final params = r['parametros'] as Json;
    final tipo = r['tipo_regla'];
    return Tarjeta(
      key: ValueKey(r['_k']),
      child: Col(gap: 12, children: [
        Segmentado<String>(
          etiqueta: 'Condición',
          valor: '$tipo',
          opciones: _tiposRegla,
          onChanged: (v) => _upd((_) {
            r['tipo_regla'] = v;
            r['parametros'] = _clonar(_paramsIniciales[v]);
          }),
        ),
        if (tipo == 'TIPO_ACCION_PRESENTE' || tipo == 'CONTEO_TIPO_ACCION')
          Segmentado<String>(
            etiqueta: 'Tipo de acción',
            valor: '${params['tipo_accion']}',
            opciones: _tipoAccionOpts,
            onChanged: (v) => _upd((_) => params['tipo_accion'] = v),
          ),
        if (tipo == 'CONTEO_TIPO_ACCION')
          Campo(
              etiqueta: 'Mínimo de veces',
              valor: '${params['minimo'] ?? ''}',
              teclado: TextInputType.number,
              onChanged: (v) => _upd((_) => params['minimo'] = v)),
        if (tipo == 'OPCION_SELECCIONADA')
          Segmentado<String>(
            etiqueta: 'Opción',
            valor: '${params['opcion']}',
            opciones: [
              for (final o in _todasLasOpciones)
                ('${o['clave']}', '${'${o['texto']}'.isEmpty ? o['clave'] : o['texto']}'),
            ],
            onChanged: (v) => _upd((_) => params['opcion'] = v),
          ),
        if (tipo == 'SECUENCIA')
          Campo(
              etiqueta: 'Claves de opciones en orden (separadas por comas)',
              mayusculas: TextCapitalization.none,
              valor: '${params['opciones'] ?? ''}',
              ayuda: 'Disponibles: ${[for (final o in _todasLasOpciones) o['clave']].join(', ')}',
              onChanged: (v) => _upd((_) => params['opciones'] = v)),
        Campo(
            etiqueta: 'Ajuste de puntuación',
            valor: '${r['ajuste_puntuacion']}',
            teclado: const TextInputType.numberWithOptions(signed: true),
            onChanged: (v) => _upd((_) => r['ajuste_puntuacion'] = v)),
        Campo(etiqueta: 'Descripción', valor: '${r['descripcion']}', onChanged: (v) => _upd((_) => r['descripcion'] = v)),
        Campo(
            etiqueta: 'Retroalimentación',
            multilinea: true,
            valor: '${r['retroalimentacion']}',
            onChanged: (v) => _upd((_) => r['retroalimentacion'] = v)),
        Segmentado<bool>(
          etiqueta: 'Activa',
          valor: r['activa'] == true,
          opciones: const [(true, 'Sí'), (false, 'No')],
          onChanged: (v) => _upd((_) => r['activa'] = v),
        ),
        Boton('Quitar regla',
            tamano: TamanoBoton.sm, variante: VarianteBoton.danger, onPressed: () => _upd((_) => _reglas.remove(r))),
      ]),
    );
  }
}

class _Encabezado extends StatelessWidget {
  const _Encabezado(this.titulo, {this.icono, this.accion});
  final String titulo;
  final IconData? icono;
  final Widget? accion;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(children: [
          if (icono != null) ...[IconoCaja(icono!, tamano: 32, radio: R.sm), const SizedBox(width: 8)],
          Expanded(child: Text(titulo, style: T.h2)),
          // Flexible: el botón necesita un ancho acotado dentro de la fila.
          if (accion != null) Flexible(child: accion!),
        ]),
      );
}
