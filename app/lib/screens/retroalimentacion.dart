import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/client.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/avisos.dart';
import '../widgets/comunes.dart';
import '../widgets/ui.dart';
import 'resultado.dart';

class _Item extends StatelessWidget {
  const _Item(this.icono, this.color, this.titulo, {this.texto, this.normal = false});
  final IconData icono;
  final Color color;
  final String titulo;
  final String? texto;
  final bool normal;

  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icono, size: 20, color: color),
        const SizedBox(width: 12),
        Expanded(
          child: Col(gap: 2, cross: CrossAxisAlignment.start, children: [
            Text(titulo, style: normal ? T.body : T.bodyStrong),
            if (texto != null) Text(texto!, style: T.body.copyWith(color: C.textMuted)),
          ]),
        ),
      ]);
}

/// Retroalimentación educativa detallada de un intento.
class Retroalimentacion extends StatefulWidget {
  const Retroalimentacion({super.key, required this.intentoId});
  final int intentoId;

  @override
  State<Retroalimentacion> createState() => _RetroalimentacionState();
}

class _RetroalimentacionState extends State<Retroalimentacion> with CargaIntento<Retroalimentacion> {
  bool _confirmando = false;

  @override
  int get intentoId => widget.intentoId;

  Future<void> _confirmar() async {
    setState(() => _confirmando = true);
    try {
      await Api.post('/attempts/$intentoId/confirm-feedback');
      if (mounted) context.go('/simulaciones');
    } on ApiError catch (e) {
      avisoError(e.message);
      if (mounted) setState(() => _confirmando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (errorCarga != null) {
      return EstadoError(mensaje: 'No fue posible cargar la retroalimentación. Intenta nuevamente.', onRetry: cargarIntento);
    }
    if (datos == null) return const Cargando();
    if (datos!['resultado'] == null) return const EstadoError(mensaje: 'Este intento aún no tiene resultados.');

    final r = datos!['resultado'] as Json;
    final escenario = datos!['escenario'] as Json;
    final decisiones = (r['decisiones'] as List).cast<Json>();
    final correctas = decisiones.where((d) => d['valoracion'] == 'correcta').toList();
    final mejorables = decisiones.where((d) => d['valoracion'] == 'mejorable').toList();
    final erroresDetalle = (r['errores_detalle'] as List).cast<Json>();
    final penalizaciones = (r['reglas_aplicadas'] as List).cast<Json>().where((x) => (x['ajuste'] as num) < 0).toList();
    final senales = r['senales'] as Json;
    final ruta = ((r['ruta_recomendada'] as List?) ?? []).cast<Json>();
    final recomendaciones = (r['recomendaciones'] as List).cast<String>();
    String? texto(Object? v) => v == null ? null : '$v';

    return Pantalla(children: [
      Col(gap: 8, children: [
        Text('${escenario['codigo']} · ${escenario['tipo_nombre']}'.toUpperCase(), style: T.overline),
        Text('${escenario['titulo']}', style: T.h1),
        Wrap(spacing: 12, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Text('${puntos(r['puntaje'])} / 100', style: T.bodyStrong),
          NivelBadge((r['nivel_vulnerabilidad'] as Json?)?['nivel']),
        ]),
      ]),

      Acordeon(
        icono: Icons.flag_outlined,
        titulo: 'Señales de alerta presentes',
        contador: senales['total'] as int,
        abiertoInicial: true,
        children: [
          for (final s in (senales['detectadas'] as List).cast<Json>())
            _Item(Icons.check_circle, C.success, 'Identificaste: ${s['descripcion']}', texto: texto(s['explicacion'])),
          for (final s in (senales['no_detectadas'] as List).cast<Json>())
            _Item(Icons.error, C.warningText, 'No identificaste: ${s['descripcion']}', texto: texto(s['explicacion'])),
        ],
      ),

      Acordeon(
        icono: Icons.done_all,
        colorIcono: C.success,
        titulo: 'Decisiones correctas',
        contador: correctas.length,
        children: [
          if (correctas.isEmpty) Text('En este intento no tomaste decisiones completamente seguras.', style: T.body),
          for (final d in correctas)
            _Item(valoraciones['correcta']!.icon!, C.success, '${d['opcion']}', texto: texto(d['retroalimentacion'])),
          for (final d in mejorables)
            _Item(valoraciones['mejorable']!.icon!, C.warningText, 'Mejorable: ${d['opcion']}',
                texto: texto(d['retroalimentacion'])),
        ],
      ),

      Acordeon(
        icono: Icons.cancel_outlined,
        colorIcono: C.danger,
        titulo: 'Errores cometidos',
        contador: erroresDetalle.length + penalizaciones.length,
        abiertoInicial: erroresDetalle.isNotEmpty,
        children: [
          if (erroresDetalle.isEmpty && penalizaciones.isEmpty)
            const Aviso(tono: Tono.success, mensaje: 'No tomaste decisiones riesgosas en este escenario.'),
          for (final d in erroresDetalle)
            _Item(valoraciones['incorrecta']!.icon!, C.danger, '${d['opcion']}', texto: texto(d['retroalimentacion'])),
          for (final x in penalizaciones)
            _Item(Icons.warning_rounded, C.danger, '${x['descripcion']}', texto: texto(x['retroalimentacion'])),
        ],
      ),

      if (ruta.isNotEmpty)
        Acordeon(
          icono: Icons.navigation_outlined,
          titulo: 'Lo más seguro habría sido',
          contador: ruta.length,
          children: [
            for (final (i, p) in ruta.indexed)
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 22,
                  height: 22,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(color: C.primarySoft, shape: BoxShape.circle),
                  child: Text('${i + 1}', style: T.caption.copyWith(color: C.primary)),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text('${p['opcion']}', style: T.body)),
              ]),
          ],
        ),

      Acordeon(
        icono: Icons.lightbulb_outline,
        colorIcono: C.warningText,
        titulo: 'Recomendaciones',
        contador: recomendaciones.length,
        abiertoInicial: true,
        children: [for (final t in recomendaciones) _Item(Icons.arrow_circle_right, C.primary, t, normal: true)],
      ),

      Text(
        'Los niveles de vulnerabilidad son provisionales y se definirán formalmente durante el análisis del proyecto.',
        style: T.caption.copyWith(fontStyle: FontStyle.italic),
        textAlign: TextAlign.center,
      ),

      if ((datos!['intento'] as Json)['resultado_revisado'] == true) ...[
        Boton('Intentar de nuevo',
            icono: Icons.refresh,
            variante: VarianteBoton.secondary,
            onPressed: () => context.push('/simulacion/${escenario['id']}')),
        Boton('Volver al inicio', variante: VarianteBoton.ghost, icono: Icons.home_outlined, onPressed: () => context.go('/')),
      ] else ...[
        const Aviso(mensaje: 'Confirma que revisaste la retroalimentación para poder iniciar otro escenario.'),
        Boton('Entendido, continuar', icono: Icons.check, cargando: _confirmando, onPressed: _confirmar),
      ],
    ]);
  }
}
