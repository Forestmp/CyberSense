import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../state/auth.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/comunes.dart';
import '../widgets/ui.dart';

class Progreso extends StatefulWidget {
  const Progreso({super.key});

  @override
  State<Progreso> createState() => _ProgresoState();
}

class _ProgresoState extends State<Progreso> {
  Json? _m;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() => _error = null);
    try {
      final m = await Api.get('/users/${context.read<Auth>().id}/metrics') as Json;
      if (mounted) setState(() => _m = m);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return EstadoError(mensaje: 'No fue posible cargar tu progreso. Intenta nuevamente.', onRetry: _cargar);
    }
    if (_m == null) return const Cargando();

    final resumen = _m!['resumen'] as Json;
    final porTipo = (_m!['por_tipo'] as List).cast<Json>();
    final evolucion = (_m!['evolucion'] as List).cast<Json>();

    if (numero(resumen['total_simulaciones']) == 0) {
      return Center(
        child: EstadoVacio(
          icono: Icons.bar_chart_outlined,
          titulo: 'Tu progreso aparecerá aquí',
          mensaje: 'Completa tu primera simulación para ver tu desempeño por tipo de ataque.',
          children: [
            Boton('Iniciar simulación', icono: Icons.play_arrow, onPressed: () => context.go('/simulaciones')),
          ],
        ),
      );
    }

    return Pantalla(
      onRefresh: _cargar,
      children: [
        Tarjeta(
          variante: VarianteTarjeta.navy,
          child: Col(gap: 12, children: [
            Text('DESEMPEÑO GENERAL', style: T.overline.copyWith(color: const Color(0xFF93C5FD))),
            Wrap(spacing: 12, runSpacing: 12, crossAxisAlignment: WrapCrossAlignment.center, alignment: WrapAlignment.spaceBetween, children: [
              Col(gap: 6, cross: CrossAxisAlignment.start, children: [
                Text.rich(TextSpan(
                  text: puntos(resumen['puntaje_promedio']),
                  style: inter(size: 36, weight: FontWeight.w800, color: Colors.white),
                  children: [
                    TextSpan(text: ' / 100', style: inter(size: 16, weight: FontWeight.w500, color: const Color(0xFF93C5FD))),
                  ],
                )),
                Text('Puntuación promedio', style: inter(color: const Color(0xFFCBD5E1))),
              ]),
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(R.pill)),
                child: NivelBadge(resumen['nivel_vulnerabilidad'], prefijo: '', grande: true),
              ),
            ]),
            BarraProgreso(
              valor: numero(resumen['puntaje_promedio']),
              color: C.cyan,
              pista: const Color(0x2EFFFFFF),
              etiqueta: 'Puntuación promedio',
            ),
          ]),
        ),

        IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: separados([
            _Kpi(Icons.play_circle_outline, '${resumen['total_simulaciones']}', 'Intentos realizados'),
            _Kpi(Icons.done_all, '${resumen['tasa_aciertos'] ?? 0}%', 'Decisiones seguras'),
            _Kpi(Icons.layers_outlined, '${resumen['escenarios_completados']}/${resumen['escenarios_disponibles']}',
                'Escenarios realizados'),
          ], 12, vertical: false)),
        ),

        const TituloSeccion('Por tipo de ataque'),
        for (final t in porTipo) _TarjetaTipo(t),

        if (evolucion.length > 1) ...[
          const TituloSeccion('Últimas simulaciones'),
          Tarjeta(
            child: Col(gap: 12, children: [
              Semantics(
                label: 'Puntajes recientes: ${evolucion.map((e) => numero(e['puntaje']).round()).join(', ')}',
                excludeSemantics: true,
                child: SizedBox(
                  height: 130,
                  child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: separados([
                    for (final e in evolucion)
                      Expanded(
                        child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                          Text('${numero(e['puntaje']).round()}', style: T.caption),
                          const SizedBox(height: 2),
                          LayoutBuilder(
                            builder: (_, c) => Container(
                              width: (c.maxWidth * 0.7).clamp(0, 28).toDouble(),
                              height: (110 * numero(e['puntaje']).clamp(4, 100) / 100).toDouble(),
                              decoration: BoxDecoration(
                                color: nivelInfo(nivelDePuntaje(numero(e['puntaje']))).bar,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                              ),
                            ),
                          ),
                        ]),
                      ),
                  ], 8, vertical: false)),
                ),
              ),
              Text('Puntuación de cada simulación, de la más antigua a la más reciente.', style: T.caption),
            ]),
          ),
        ],
      ],
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.icono, this.valor, this.etiqueta);
  final IconData icono;
  final String valor;
  final String etiqueta;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Tarjeta(
          padding: const EdgeInsets.all(12),
          semantica: '$etiqueta: $valor',
          child: Col(gap: 4, cross: CrossAxisAlignment.start, children: [
            Icon(icono, size: 20, color: C.primary),
            Text(valor, style: inter(size: 22, weight: FontWeight.w700, color: C.navy)),
            Text(etiqueta, style: T.caption),
          ]),
        ),
      );
}

class _TarjetaTipo extends StatelessWidget {
  const _TarjetaTipo(this.t);
  final Json t;

  @override
  Widget build(BuildContext context) {
    final nivel = nivelInfo(t['nivel_vulnerabilidad']);
    final tipo = tipoInfo(t['tipo']);
    final intentos = numero(t['total_intentos']);
    final aciertos = numero(t['aciertos']).toInt();
    final errores = numero(t['errores']).toInt();
    final total = aciertos + errores;

    return Tarjeta(
      child: Col(gap: 12, children: [
        Row(children: [
          IconoCaja(tipo.icon, tamano: 38),
          const SizedBox(width: 12),
          Expanded(child: Text('${t['tipo_nombre']}', style: T.h3)),
          intentos > 0 ? NivelBadge(t['nivel_vulnerabilidad'], prefijo: '') : Text('Sin práctica', style: T.caption),
        ]),
        if (intentos > 0) ...[
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('Puntuación promedio', style: T.small),
            Text('${puntos(t['puntaje_promedio'])} / 100', style: T.bodyStrong),
          ]),
          BarraProgreso(
              valor: numero(t['puntaje_promedio']), color: nivel.bar, etiqueta: 'Puntuación promedio en ${t['tipo_nombre']}'),
          Wrap(alignment: WrapAlignment.spaceBetween, spacing: 8, runSpacing: 4, children: [
            Text('${intentos.toInt()} intento(s) · último ${puntos(t['ultimo_puntaje'])}', style: T.small),
            Text.rich(TextSpan(style: T.small, children: [
              TextSpan(
                  text: '$aciertos ${aciertos == 1 ? 'segura' : 'seguras'}',
                  style: inter(size: 13, weight: FontWeight.w600, color: C.successText)),
              const TextSpan(text: ' · '),
              TextSpan(
                  text: '$errores ${errores == 1 ? 'error' : 'errores'}',
                  style: inter(size: 13, weight: FontWeight.w600, color: C.dangerText)),
            ])),
          ]),
          if (total > 0)
            BarraProgreso(
                valor: aciertos / total * 100, color: C.success, alto: 6, etiqueta: 'Proporción de decisiones seguras'),
        ] else
          Boton('Practicar ${'${t['tipo_nombre']}'.toLowerCase()}',
              tamano: TamanoBoton.sm, variante: VarianteBoton.secondary, onPressed: () => context.go('/simulaciones')),
      ]),
    );
  }
}
