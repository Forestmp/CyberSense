import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/client.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/tarjetas.dart';
import '../widgets/ui.dart';

/// Carga un intento (paso actual o resultado) con estado de error y reintento.
mixin CargaIntento<W extends StatefulWidget> on State<W> {
  int get intentoId;
  Json? datos;
  String? errorCarga;

  @override
  void initState() {
    super.initState();
    cargarIntento();
  }

  Future<void> cargarIntento() async {
    setState(() => errorCarga = null);
    try {
      final r = await Api.get('/attempts/$intentoId') as Json;
      if (mounted) setState(() => datos = r);
    } on ApiError catch (e) {
      if (mounted) setState(() => errorCarga = e.message);
    }
  }
}

class Resultado extends StatefulWidget {
  const Resultado({super.key, required this.intentoId});
  final int intentoId;

  @override
  State<Resultado> createState() => _ResultadoState();
}

class _ResultadoState extends State<Resultado> with CargaIntento<Resultado> {
  @override
  int get intentoId => widget.intentoId;

  Future<void> _verRetroalimentacion() async {
    await context.push('/retroalimentacion/$intentoId');
    if (mounted) cargarIntento();
  }

  @override
  Widget build(BuildContext context) {
    if (errorCarga != null) {
      return EstadoError(mensaje: 'No fue posible cargar los resultados. Intenta nuevamente.', onRetry: cargarIntento);
    }
    if (datos == null) return const Cargando();
    if (datos!['resultado'] == null) return const EstadoError(mensaje: 'Este intento aún no tiene resultados.');

    final r = datos!['resultado'] as Json;
    final escenario = datos!['escenario'] as Json;
    final intento = datos!['intento'] as Json;
    final decisiones = (r['decisiones'] as List).cast<Json>();
    final errores = (r['errores_detalle'] as List).length;
    final revisado = intento['resultado_revisado'] == true;

    return Pantalla(children: [
      TarjetaResultado(
        resultado: r,
        titulo: '${escenario['codigo']} · ${escenario['titulo']}',
        subtitulo: 'Intento ${intento['numero_intento']} · ${fechaHora(intento['fecha_fin'])}',
      ),
      const TituloSeccion('Resumen de decisiones'),
      Tarjeta(
        child: Column(children: [
          for (final (i, d) in decisiones.indexed)
            Container(
              padding: EdgeInsets.only(top: i > 0 ? 12 : 0, bottom: i < decisiones.length - 1 ? 12 : 0),
              decoration: i > 0 ? const BoxDecoration(border: Border(top: BorderSide(color: C.border))) : null,
              child: Builder(builder: (_) {
                final v = valoraciones[d['valoracion']] ?? valoraciones['mejorable']!;
                return Row(children: [
                  Icon(v.icon, size: 22, color: v.fg, semanticLabel: v.label),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${d['opcion']}', style: T.bodyStrong),
                      Text('${v.label}${d['paso'] != null ? ' · ${d['paso']}' : ''}', style: T.caption.copyWith(color: v.fg)),
                    ]),
                  ),
                ]);
              }),
            ),
        ]),
      ),
      if (errores > 0)
        Tarjeta(
          variante: VarianteTarjeta.contorno,
          elevada: false,
          color: C.warningSoft,
          borde: const BorderSide(color: C.warningSoft),
          child: Row(children: [
            const Icon(Icons.warning_amber_rounded, size: 20, color: C.warningText),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Cometiste $errores ${errores == 1 ? 'error' : 'errores'}. Revisa los detalles para saber qué señales pasaste por alto.',
                style: T.body,
              ),
            ),
          ]),
        ),
      Col(gap: 10, children: [
        // RN-13: la retroalimentación debe revisarse y confirmarse antes de iniciar otro escenario.
        Boton(revisado ? 'Ver retroalimentación' : 'Revisar retroalimentación',
            icono: Icons.school_outlined, onPressed: _verRetroalimentacion),
        if (revisado)
          Boton('Continuar',
              icono: Icons.arrow_forward, variante: VarianteBoton.secondary, onPressed: () => context.go('/simulaciones')),
        Boton('Volver al inicio', variante: VarianteBoton.ghost, icono: Icons.home_outlined, onPressed: () => context.go('/')),
      ]),
    ]);
  }
}
