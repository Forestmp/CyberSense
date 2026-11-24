import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';
import '../../util/etiquetas.dart';
import '../../widgets/avisos.dart';
import '../../widgets/comunes.dart';
import '../../widgets/contenido_simulado.dart';
import '../../widgets/ui.dart';

String _describirRegla(Json r) {
  final p = (r['parametros'] as Json?) ?? const {};
  return switch (r['tipo_regla']) {
    'OPCION_SELECCIONADA' => 'Si elige «${p['opcion']}»',
    'TIPO_ACCION_PRESENTE' => 'Si toma alguna decisión ${p['tipo_accion']}',
    'CONTEO_TIPO_ACCION' => 'Si toma ${p['minimo']} o más decisiones ${p['tipo_accion']}',
    'SECUENCIA' => 'Si elige en orden: ${((p['opciones'] as List?) ?? []).join(' → ')}',
    _ => '${r['tipo_regla']}',
  };
}

String _conSigno(Object? n) => (n is num && n > 0) ? '+$n' : '$n';

/// Vista de solo lectura de un escenario con toda su estructura.
class VerEscenario extends StatefulWidget {
  const VerEscenario({super.key, required this.escenarioId});
  final int escenarioId;

  @override
  State<VerEscenario> createState() => _VerEscenarioState();
}

class _VerEscenarioState extends State<VerEscenario> {
  Json? _e;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    try {
      final r = await Api.get('/scenarios/${widget.escenarioId}');
      if (mounted) setState(() => _e = r['escenario'] as Json);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _cambiarEstado(String estado) async {
    try {
      final r = await Api.patch('/scenarios/${widget.escenarioId}', {'estado': estado});
      setState(() => _e!['estado'] = r['escenario']['estado']);
      avisoExito(estado == 'activo' ? 'Escenario activado' : 'Escenario desactivado');
    } on ApiError catch (err) {
      avisoError(err.message);
    }
  }

  Future<void> _eliminar() async {
    if (!await confirmar(context,
        titulo: 'Eliminar escenario',
        mensaje: '¿Eliminar «${_e!['titulo']}»? El historial de los usuarios se conserva.',
        textoConfirmar: 'Eliminar',
        peligro: true)) {
      return;
    }
    try {
      await Api.delete('/scenarios/${widget.escenarioId}');
      avisoExito('Escenario eliminado');
      if (mounted) context.pop();
    } on ApiError catch (err) {
      avisoError(err.message);
    }
  }

  Future<void> _editar() async {
    await context.push('/admin/escenarios/${widget.escenarioId}/editar');
    if (mounted) _cargar();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_e == null ? 'Escenario' : '${_e!['codigo']}')),
      body: SafeArea(top: false, child: _cuerpo()),
    );
  }

  Widget _cuerpo() {
    if (_e == null && _error == null) return const Cargando();
    if (_e == null) return EstadoError(mensaje: 'No fue posible cargar el escenario. $_error', onRetry: () => context.pop());

    final e = _e!;
    final pasos = (e['pasos'] as List).cast<Json>();
    final senales = (e['senales'] as List).cast<Json>();
    final reglas = (e['reglas'] as List).cast<Json>();
    final eliminado = e['estado'] == 'eliminado';
    final activo = e['estado'] == 'activo';
    String tituloPaso(Object? clave) =>
        '${pasos.where((p) => p['clave'] == clave).firstOrNull?['titulo'] ?? clave}';

    return Pantalla(children: [
      Tarjeta(
        child: Col(gap: 8, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('${e['codigo']}', style: inter(size: 13, weight: FontWeight.w700, color: C.primary)),
            EstadoBadge(e['estado']),
          ]),
          Text('${e['titulo']}', style: T.h1),
          Text('${e['tipo_nombre']} · ${e['dificultad_nombre']} · ${e['total_intentos']} intento(s) registrados', style: T.caption),
          Text('${e['descripcion']}', style: T.body),
          if ((e['contenido'] as Json?)?['contexto'] != null)
            Text('Contexto: ${e['contenido']['contexto']}', style: T.body.copyWith(color: C.textMuted)),
          Text('Actualizado: ${fechaHora(e['fecha_actualizacion'])}', style: T.caption),
        ]),
      ),

      if (!eliminado)
        Row(children: separados([
          Expanded(child: Boton('Editar', tamano: TamanoBoton.sm, icono: Icons.edit_outlined, onPressed: _editar)),
          Expanded(
            child: activo
                ? Boton('Desactivar',
                    tamano: TamanoBoton.sm,
                    icono: Icons.pause_circle_outline,
                    variante: VarianteBoton.secondary,
                    onPressed: () => _cambiarEstado('inactivo'))
                : Boton('Activar',
                    tamano: TamanoBoton.sm,
                    icono: Icons.play_circle_outline,
                    variante: VarianteBoton.secondary,
                    onPressed: () => _cambiarEstado('activo')),
          ),
          if (activo)
            Expanded(
              child: Boton('Probar',
                  tamano: TamanoBoton.sm,
                  icono: Icons.play_arrow_outlined,
                  variante: VarianteBoton.outline,
                  onPressed: () => context.push('/simulacion/${widget.escenarioId}')),
            ),
        ], 8, vertical: false)),

      TituloSeccion('Señales de alerta (${senales.length})'),
      for (final s in senales)
        Tarjeta(
          child: Col(gap: 2, children: [
            Text('${s['descripcion']}', style: T.bodyStrong),
            Text('${s['clave']}', style: T.caption),
            Text('${s['explicacion']}', style: T.body),
          ]),
        ),

      TituloSeccion('Pasos y opciones (${pasos.length})'),
      for (final (i, p) in pasos.indexed)
        Tarjeta(
          child: Col(gap: 12, children: [
            Text('Paso ${i + 1} · ${p['clave']}${p['es_inicial'] == true ? ' · INICIAL' : ''}', style: T.caption),
            Text('${p['titulo']}', style: T.bodyStrong),
            ContenidoSimulado(p['contenido'] as Json?),
            Text('${p['pregunta']}', style: T.body),
            for (final o in (p['opciones'] as List).cast<Json>()) _opcion(o, tituloPaso),
          ]),
        ),

      TituloSeccion('Reglas de evaluación (${reglas.length})'),
      if (reglas.isEmpty) Text('Sin reglas específicas.', style: T.caption),
      for (final r in reglas)
        Opacity(
          opacity: r['activa'] == true ? 1 : 0.5,
          child: Tarjeta(
            child: Col(gap: 2, children: [
              Row(children: [
                Expanded(child: Text('${r['descripcion']}', style: T.bodyStrong)),
                Text(_conSigno(r['ajuste_puntuacion']),
                    style: inter(
                        weight: FontWeight.w800,
                        color: (r['ajuste_puntuacion'] as num) < 0 ? C.danger : C.success)),
              ]),
              Text(_describirRegla(r), style: T.caption),
              if (r['retroalimentacion'] != null) Text('${r['retroalimentacion']}', style: T.body),
            ]),
          ),
        ),

      if (e['retroalimentacion_general'] != null) ...[
        const TituloSeccion('Retroalimentación general'),
        Tarjeta(child: Text('${e['retroalimentacion_general']}', style: T.body)),
      ],

      if (!eliminado) Boton('Eliminar escenario', variante: VarianteBoton.danger, onPressed: _eliminar),
    ]);
  }

  Widget _opcion(Json o, String Function(Object?) tituloPaso) {
    final t = tiposAccion[o['tipo_accion']] ?? tiposAccion['neutral']!;
    final senales = (o['senales'] as List?) ?? [];
    return Container(
      padding: const EdgeInsets.only(left: 12),
      decoration: BoxDecoration(border: Border(left: BorderSide(color: t.fg, width: 3))),
      child: Col(gap: 3, children: [
        Row(children: [
          Expanded(child: Text('${o['texto']}', style: T.bodyStrong)),
          Text(_conSigno(o['puntuacion']), style: inter(weight: FontWeight.w800, color: t.fg)),
        ]),
        Text(
          '${t.label} · ${o['siguiente_paso'] != null ? '→ ${tituloPaso(o['siguiente_paso'])}' : 'Termina el escenario'}'
          '${senales.isNotEmpty ? ' · identifica: ${senales.join(', ')}' : ''}',
          style: T.caption,
        ),
        Text('${o['retroalimentacion']}', style: T.body),
      ]),
    );
  }
}
