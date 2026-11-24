import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../state/auth.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/comunes.dart';
import '../widgets/ui.dart';

class Historial extends StatefulWidget {
  const Historial({super.key});

  @override
  State<Historial> createState() => _HistorialState();
}

class _HistorialState extends State<Historial> {
  List<Json>? _datos;
  int _pagina = 1;
  int _paginas = 1;
  int _total = 0;
  String _tipo = '';
  bool _cargandoMas = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar([int pagina = 1]) async {
    setState(() {
      _error = null;
      if (pagina > 1) _cargandoMas = true;
    });
    try {
      final r = await Api.get('/users/${context.read<Auth>().id}/history',
          query: {'pagina': pagina, 'limite': 20, 'tipo': _tipo}) as Json;
      if (!mounted) return;
      final nuevos = (r['datos'] as List).cast<Json>();
      setState(() {
        _datos = pagina == 1 ? nuevos : [...?_datos, ...nuevos];
        _pagina = r['pagina'] as int;
        _paginas = r['paginas'] as int;
        _total = r['total'] as int;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _cargandoMas = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _datos == null) {
      return EstadoError(mensaje: 'No fue posible cargar tu historial. Intenta nuevamente.', onRetry: _cargar);
    }
    if (_datos == null) return const Cargando();

    return Pantalla(
      onRefresh: _cargar,
      gap: 12,
      children: [
        Segmentado<String>(
          opciones: const [('', 'Todos'), ('phishing', 'Phishing'), ('smishing', 'Smishing'), ('suplantacion_identidad', 'Suplantación')],
          valor: _tipo,
          onChanged: (v) {
            setState(() => _tipo = v);
            _cargar();
          },
        ),
        if (_total > 0) Text('$_total simulación(es) realizadas', style: T.small),
        if (_datos!.isEmpty)
          EstadoVacio(
            icono: Icons.history,
            titulo: 'Aún no hay simulaciones',
            mensaje: 'Cuando completes un escenario aparecerá aquí con su puntuación y nivel de vulnerabilidad.',
            children: [
              Boton('Iniciar simulación', icono: Icons.play_arrow, onPressed: () => context.go('/simulaciones')),
            ],
          ),
        for (final h in _datos!) _Fila(h),
        if (_cargandoMas)
          const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
        else if (_pagina < _paginas)
          Boton('Cargar más', variante: VarianteBoton.ghost, onPressed: () => _cargar(_pagina + 1)),
      ],
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila(this.h);
  final Json h;

  @override
  Widget build(BuildContext context) => Tarjeta(
        onTap: () => context.push('/resultado/${h['intento_id']}'),
        semantica: '${h['titulo']}, ${puntos(h['puntaje'])} puntos, ver detalles',
        child: Row(children: [
          IconoCaja(tipoInfo(h['tipo']).icon, tamano: 42),
          const SizedBox(width: 12),
          Expanded(
            child: Col(gap: 4, cross: CrossAxisAlignment.start, children: [
              Text('${h['titulo']}', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text('${h['tipo_nombre']} · ${fechaHora(h['fecha_fin'])}', style: T.caption),
              Wrap(spacing: 12, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                Dificultad(clave: h['dificultad'], nombre: h['dificultad_nombre']),
                NivelBadge(h['nivel_vulnerabilidad'], prefijo: ''),
              ]),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(puntos(h['puntaje']), style: inter(size: 22, weight: FontWeight.w800, color: C.navy)),
            Text('/ 100', style: T.caption),
            const Icon(Icons.chevron_right, size: 18, color: C.textMuted),
          ]),
        ]),
      );
}
