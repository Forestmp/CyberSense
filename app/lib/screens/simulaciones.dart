import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/client.dart';
import '../widgets/tarjetas.dart';
import '../widgets/ui.dart';

class Simulaciones extends StatefulWidget {
  const Simulaciones({super.key});

  @override
  State<Simulaciones> createState() => _SimulacionesState();
}

class _SimulacionesState extends State<Simulaciones> {
  List<Json>? _escenarios;
  List<Json> _tipos = [];
  Object? _recomendadoId;
  String _tipo = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() => _error = null);
    try {
      final r = await Future.wait([
        Api.get('/scenarios', query: {'limite': 100}),
        Api.get('/scenarios/recommended'),
        Api.get('/catalogos'),
      ]);
      if (!mounted) return;
      setState(() {
        _escenarios = (r[0]['datos'] as List).cast<Json>();
        _recomendadoId = r[1]['recomendacion']?['escenario']?['id'];
        _tipos = (r[2]['tipos_ataque'] as List).cast<Json>();
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _abrir(Json e) async {
    await context.push('/simulacion/${e['id']}');
    if (mounted) _cargar();
  }

  @override
  Widget build(BuildContext context) {
    if (_escenarios == null && _error == null) return const Cargando();
    if (_escenarios == null) {
      return EstadoError(mensaje: 'No fue posible cargar los escenarios. Intenta nuevamente.', onRetry: _cargar);
    }

    // El recomendado va primero; los demás conservan el orden de la API.
    final delTipo = _escenarios!.where((e) => _tipo.isEmpty || e['tipo'] == _tipo);
    final filtrados = [
      ...delTipo.where((e) => e['id'] == _recomendadoId),
      ...delTipo.where((e) => e['id'] != _recomendadoId),
    ];

    return Pantalla(
      onRefresh: _cargar,
      children: [
        const Subtitulo(
            'Elige un escenario y actúa como lo harías en la vida real. La retroalimentación aparece al terminar.'),
        Segmentado<String>(
          opciones: [('', 'Todos'), for (final t in _tipos) ('${t['clave']}', '${t['nombre']}')],
          valor: _tipo,
          onChanged: (v) => setState(() => _tipo = v),
        ),
        if (filtrados.isEmpty)
          const EstadoVacio(
            icono: Icons.layers_outlined,
            titulo: 'Sin escenarios disponibles',
            mensaje: 'Todavía no hay escenarios activos de este tipo de ataque.',
          )
        else
          Col(gap: 12, children: [
            for (final e in filtrados)
              TarjetaEscenario(escenario: e, recomendado: e['id'] == _recomendadoId, onTap: () => _abrir(e)),
          ]),
      ],
    );
  }
}
