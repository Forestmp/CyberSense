/// Componentes de dominio pequeños: acordeón, insignias de nivel y estado,
/// requisitos de contraseña e indicador de dificultad.
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import '../util/etiquetas.dart';
import '../util/validacion.dart';
import 'ui.dart';

/// Sección plegable con ícono, título y contador opcional.
class Acordeon extends StatefulWidget {
  const Acordeon({
    super.key,
    required this.icono,
    required this.titulo,
    required this.children,
    this.colorIcono = C.primary,
    this.contador,
    this.abiertoInicial = false,
  });

  final IconData icono;
  final String titulo;
  final List<Widget> children;
  final Color colorIcono;
  final int? contador;
  final bool abiertoInicial;

  @override
  State<Acordeon> createState() => _AcordeonState();
}

class _AcordeonState extends State<Acordeon> {
  late bool _abierto = widget.abiertoInicial;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Semantics(
          button: true,
          expanded: _abierto,
          label: '${widget.titulo}${widget.contador != null ? ', ${widget.contador}' : ''}',
          child: InkWell(
            onTap: () => setState(() => _abierto = !_abierto),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                IconoCaja(widget.icono, tamano: 34, radio: R.sm, color: widget.colorIcono,
                    fondo: widget.colorIcono.withValues(alpha: 0.1)),
                const SizedBox(width: 12),
                Expanded(child: Text(widget.titulo, style: T.h3)),
                if (widget.contador != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                    decoration: BoxDecoration(color: C.neutralSoft, borderRadius: BorderRadius.circular(R.pill)),
                    child: Text('${widget.contador}', style: T.caption),
                  ),
                const SizedBox(width: 8),
                Icon(_abierto ? Icons.expand_less : Icons.expand_more, size: 20, color: C.textMuted),
              ]),
            ),
          ),
        ),
        if (_abierto)
          Container(
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.border))),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Col(gap: 12, children: widget.children),
          ),
      ]),
    );
  }
}

/// Nivel de vulnerabilidad con ícono y texto, no solo color.
class NivelBadge extends StatelessWidget {
  const NivelBadge(this.nivel, {super.key, this.prefijo = 'Vulnerabilidad', this.grande = false});
  final Object? nivel;
  final String prefijo;
  final bool grande;

  @override
  Widget build(BuildContext context) {
    final n = nivelInfo(nivel);
    final texto = prefijo.isNotEmpty ? '$prefijo ${n.label.toLowerCase()}' : n.label;
    return Semantics(
      label: '$prefijo ${n.label}',
      excludeSemantics: true,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: grande ? 16 : 10, vertical: grande ? 8 : 3),
        decoration: BoxDecoration(color: n.bg, borderRadius: BorderRadius.circular(R.pill)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(n.icon, size: grande ? 18 : 13, color: n.fg),
          const SizedBox(width: 6),
          Text(texto, style: inter(size: grande ? 15 : 12, weight: FontWeight.w600, color: n.fg)),
        ]),
      ),
    );
  }
}

/// Estado de un escenario con ícono y texto.
class EstadoBadge extends StatelessWidget {
  const EstadoBadge(this.estado, {super.key});
  final Object? estado;

  @override
  Widget build(BuildContext context) {
    final e = estadosEscenario[estado] ?? estadosEscenario['borrador']!;
    return Insignia(e.label, icono: e.icon, bg: e.bg, fg: e.fg);
  }
}

/// Lista de requisitos de la contraseña que se marca conforme se cumplen.
class ReglasPassword extends StatelessWidget {
  const ReglasPassword(this.password, {super.key});
  final String password;

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Requisitos de la contraseña',
        child: Col(gap: 4, children: [
          for (final r in reglasPassword(password))
            Row(children: [
              Icon(r.ok ? Icons.check_circle : Icons.radio_button_unchecked, size: 15,
                  color: r.ok ? C.success : C.textMuted),
              const SizedBox(width: 6),
              Text(r.texto, style: r.ok ? T.small.copyWith(color: C.successText) : T.small),
            ]),
        ]),
      );
}

/// Indicador de dificultad con barras (1 a 3) además del texto.
class Dificultad extends StatelessWidget {
  const Dificultad({super.key, required this.clave, required this.nombre});
  final Object? clave;
  final Object? nombre;

  @override
  Widget build(BuildContext context) {
    final n = dificultades[clave] ?? 1;
    return Semantics(
      label: 'Dificultad $nombre',
      excludeSemantics: true,
      child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
        for (var i = 1; i <= 3; i++) ...[
          Container(
            width: 5,
            height: 4.0 + i * 3,
            decoration: BoxDecoration(color: i <= n ? C.primary : C.border, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(width: 3),
        ],
        const SizedBox(width: 2),
        Text('$nombre', style: T.caption),
      ]),
    );
  }
}
