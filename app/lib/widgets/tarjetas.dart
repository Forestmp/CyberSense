/// Tarjetas de escenario y de resultado de una simulación.
library;

import 'package:flutter/material.dart';

import '../api/client.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import 'comunes.dart';
import 'ui.dart';

/// Tarjeta de escenario para el listado de simulaciones.
class TarjetaEscenario extends StatelessWidget {
  const TarjetaEscenario({super.key, required this.escenario, required this.onTap, this.recomendado = false});
  final Json escenario;
  final VoidCallback onTap;
  final bool recomendado;

  @override
  Widget build(BuildContext context) {
    final e = escenario;
    final tipo = tipoInfo(e['tipo']);
    final intentos = (e['mis_intentos'] as int?) ?? 0;
    return Tarjeta(
      onTap: onTap,
      semantica: '${e['titulo']}, ${e['tipo_nombre']}, ${e['dificultad_nombre']}',
      borde: recomendado ? const BorderSide(color: C.primary, width: 1.5) : null,
      child: Col(gap: 12, children: [
        Row(children: [
          IconoCaja(tipo.icon, tamano: 46),
          const SizedBox(width: 12),
          Expanded(
            child: Col(gap: 2, children: [
              Text('${e['tipo_nombre']} · ${e['codigo']}'.toUpperCase(), style: T.overline),
              Text('${e['titulo']}', style: T.h3),
            ]),
          ),
          if (recomendado) const Insignia('Recomendado', tono: TonoInsignia.navy, icono: Icons.star),
        ]),
        Text('${e['descripcion']}', style: T.body.copyWith(color: C.textMuted), maxLines: 3, overflow: TextOverflow.ellipsis),
        Wrap(spacing: 12, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Dificultad(clave: e['dificultad'], nombre: e['dificultad_nombre']),
          if (intentos > 0) NivelBadge(e['mi_ultimo_nivel'], prefijo: ''),
          if (intentos > 0) Text('Mejor: ${puntos(e['mi_mejor_puntaje'])} pts', style: T.caption),
          Row(mainAxisSize: MainAxisSize.min, children: [
            Text(intentos > 0 ? 'Repetir' : 'Comenzar', style: inter(size: 14, weight: FontWeight.w600, color: C.primary)),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_forward, size: 16, color: C.primary),
          ]),
        ]),
      ]),
    );
  }
}

class _Indicador extends StatelessWidget {
  const _Indicador(this.icono, this.color, this.valor, this.etiqueta);
  final IconData icono;
  final Color color;
  final String valor;
  final String etiqueta;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Semantics(
          label: '$etiqueta: $valor',
          excludeSemantics: true,
          child: Column(children: [
            Icon(icono, size: 18, color: color),
            Text(valor, style: inter(size: 20, weight: FontWeight.w700, color: C.navy)),
            Text(etiqueta, style: T.caption, textAlign: TextAlign.center),
          ]),
        ),
      );
}

/// Resumen del resultado de una simulación: puntaje, nivel e indicadores.
class TarjetaResultado extends StatelessWidget {
  const TarjetaResultado({super.key, required this.resultado, this.titulo, this.subtitulo});
  final Json resultado;
  final String? titulo;
  final String? subtitulo;

  @override
  Widget build(BuildContext context) {
    final r = resultado;
    final nivelR = r['nivel_vulnerabilidad'] as Json?;
    final nivel = nivelInfo(nivelR?['nivel']);
    final pen = r['penalizaciones'] as Json?;
    final senales = r['senales'] as Json;

    String? detallePenalizacion;
    if (pen != null && (pen['total'] as num) > 0) {
      final mayores = pen['errores_mayores'] as int;
      final menores = pen['errores_menores'] as int;
      final ajustes = pen['ajustes_reglas'] as num;
      detallePenalizacion = [
        if (mayores > 0) '$mayores error(es) mayor(es) −${mayores * (pen['puntos_por_mayor'] as int)}',
        if (menores > 0) '$menores error(es) menor(es) −${menores * (pen['puntos_por_menor'] as int)}',
        if (ajustes != 0) 'reglas ${ajustes > 0 ? '+' : ''}$ajustes',
      ].join(' · ');
    }

    return Container(
      decoration: BoxDecoration(
        color: C.surface,
        borderRadius: BorderRadius.circular(R.xl),
        border: Border.all(color: C.border),
        boxShadow: Sombra.md,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Container(height: 5, color: nivel.bar),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 19, 20, 20),
          child: Col(gap: 12, cross: CrossAxisAlignment.center, children: [
            if (titulo != null) Text(titulo!.toUpperCase(), style: T.overline, textAlign: TextAlign.center),
            Semantics(
              label: 'Puntuación ${puntos(r['puntaje'])} de 100',
              excludeSemantics: true,
              child: Container(
                width: 128,
                height: 128,
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: nivel.bar, width: 8)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(puntos(r['puntaje']), style: inter(size: 38, height: 44, weight: FontWeight.w800, color: C.navy)),
                  Text('de 100', style: T.caption),
                ]),
              ),
            ),
            NivelBadge(nivelR?['nivel'], grande: true),
            if (r['es_vulnerable'] == true)
              const Insignia('Escenario vulnerable · menos de 60 puntos', tono: TonoInsignia.danger, icono: Icons.warning_rounded),
            if (detallePenalizacion != null) Text(detallePenalizacion, style: T.caption, textAlign: TextAlign.center),
            if (nivelR?['descripcion'] != null)
              Text('${nivelR!['descripcion']}', style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
            BarraProgreso(valor: numero(r['puntaje']), color: nivel.bar, etiqueta: 'Puntuación'),
            Container(
              padding: const EdgeInsets.only(top: 12),
              margin: const EdgeInsets.only(top: 4),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.border))),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _Indicador(Icons.check_circle, C.success, '${r['aciertos']}', 'Decisiones seguras'),
                _Indicador(Icons.cancel, C.danger, '${r['errores']}', 'Errores'),
                _Indicador(Icons.flag, C.primary, '${(senales['detectadas'] as List).length}/${senales['total']}',
                    'Señales detectadas'),
              ]),
            ),
            if (subtitulo != null) Text(subtitulo!, style: T.caption),
          ]),
        ),
      ]),
    );
  }
}
