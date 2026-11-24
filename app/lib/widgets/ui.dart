/// Componentes base de CyberSense. Todas las pantallas los usan para mantener
/// una identidad visual consistente.
library;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Intercala un espacio de [gap] entre los hijos (para Column/Row).
List<Widget> separados(List<Widget> hijos, double gap, {bool vertical = true}) => [
      for (var i = 0; i < hijos.length; i++) ...[
        if (i > 0) vertical ? SizedBox(height: gap) : SizedBox(width: gap),
        hijos[i],
      ],
    ];

/// Columna con espacio uniforme entre hijos.
class Col extends StatelessWidget {
  const Col({super.key, required this.children, this.gap = 16, this.cross = CrossAxisAlignment.stretch});
  final List<Widget> children;
  final double gap;
  final CrossAxisAlignment cross;

  @override
  Widget build(BuildContext context) =>
      Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: cross, children: separados(children, gap));
}

/* ------------------------------------------------------------------ Logo */

/// Logo oficial. `completo` incluye la palabra CyberSense; se respeta la proporción original.
class Logo extends StatelessWidget {
  const Logo({super.key, this.completo = true, this.ancho = 200});
  final bool completo;
  final double ancho;

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'CyberSense',
        image: true,
        child: Image.asset(
          completo ? 'assets/logo-cybersense.png' : 'assets/logo-escudo.png',
          width: ancho,
          height: completo ? (ancho * 509 / 720).roundToDouble() : ancho,
          fit: BoxFit.contain,
        ),
      );
}

/// Escudo + nombre en una línea, para encabezados.
class Marca extends StatelessWidget {
  const Marca({super.key, this.tamano = 28});
  final double tamano;

  @override
  Widget build(BuildContext context) {
    final estilo = inter(size: tamano * 0.68, weight: FontWeight.w800, color: C.navy, letterSpacing: -0.3);
    return Semantics(
      header: true,
      label: 'CyberSense',
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Logo(completo: false, ancho: tamano),
        const SizedBox(width: 8),
        Text.rich(TextSpan(text: 'Cyber', style: estilo, children: [
          TextSpan(text: 'Sense', style: estilo.copyWith(color: C.bright)),
        ])),
      ]),
    );
  }
}

/* ---------------------------------------------------------------- Layout */

/// Contenido de pantalla con scroll y ancho máximo (cómodo en tablet y escritorio).
class Pantalla extends StatelessWidget {
  const Pantalla({super.key, required this.children, this.maxWidth = 560, this.onRefresh, this.gap = 16, this.padding});
  final List<Widget> children;
  final double maxWidth;
  final Future<void> Function()? onRefresh;
  final double gap;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final scroll = SingleChildScrollView(
      physics: onRefresh != null ? const AlwaysScrollableScrollPhysics() : null,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: Padding(
            padding: padding ?? const EdgeInsets.all(20),
            child: Col(gap: gap, children: children),
          ),
        ),
      ),
    );
    return onRefresh == null ? scroll : RefreshIndicator(onRefresh: onRefresh!, color: C.primary, child: scroll);
  }
}

class TituloSeccion extends StatelessWidget {
  const TituloSeccion(this.texto, {super.key, this.derecha});
  final String texto;
  final Widget? derecha;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(children: [
          Expanded(child: Semantics(header: true, child: Text(texto, style: T.h2))),
          if (derecha != null) derecha!,
        ]),
      );
}

class Subtitulo extends StatelessWidget {
  const Subtitulo(this.texto, {super.key});
  final String texto;

  @override
  Widget build(BuildContext context) => Text(texto, style: T.body.copyWith(color: C.textMuted));
}

/* ------------------------------------------------------------------ Card */

enum VarianteTarjeta { normal, suave, navy, contorno }

class Tarjeta extends StatelessWidget {
  const Tarjeta({
    super.key,
    required this.child,
    this.onTap,
    this.variante = VarianteTarjeta.normal,
    this.elevada = true,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.borde,
    this.semantica,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VarianteTarjeta variante;
  final bool elevada;
  final EdgeInsets padding;
  final Color? color;
  final BorderSide? borde;
  final String? semantica;

  @override
  Widget build(BuildContext context) {
    final (fondo, linea) = switch (variante) {
      VarianteTarjeta.normal => (C.surface, C.border),
      VarianteTarjeta.suave => (C.primarySoft, C.primarySoft),
      VarianteTarjeta.navy => (C.navy, C.navy),
      VarianteTarjeta.contorno => (Colors.transparent, C.border),
    };
    final forma = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(R.lg),
      side: borde ?? BorderSide(color: linea),
    );
    return Semantics(
      button: onTap != null,
      label: semantica,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.lg),
          boxShadow: elevada && variante == VarianteTarjeta.normal ? Sombra.md : null,
        ),
        child: Material(
          color: color ?? fondo,
          shape: forma,
          clipBehavior: Clip.antiAlias,
          child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
        ),
      ),
    );
  }
}

/* ---------------------------------------------------------------- Button */

enum VarianteBoton { primary, secondary, outline, danger, dangerSolid, ghost, light }

enum TamanoBoton { sm, md, lg }

class Boton extends StatelessWidget {
  const Boton(
    this.titulo, {
    super.key,
    required this.onPressed,
    this.variante = VarianteBoton.primary,
    this.tamano = TamanoBoton.md,
    this.cargando = false,
    this.deshabilitado = false,
    this.icono,
    this.iconoDerecha,
  });

  final String? titulo;
  final VoidCallback? onPressed;
  final VarianteBoton variante;
  final TamanoBoton tamano;
  final bool cargando;
  final bool deshabilitado;
  final IconData? icono;
  final IconData? iconoDerecha;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, borde) = switch (variante) {
      VarianteBoton.primary => (C.primary, Colors.white, C.primary),
      VarianteBoton.secondary => (C.primarySoft, C.primary, C.primarySoft),
      VarianteBoton.outline => (C.surface, C.primary, C.primary),
      VarianteBoton.danger => (C.surface, C.dangerText, const Color(0xFFFCA5A5)),
      VarianteBoton.dangerSolid => (C.danger, Colors.white, C.danger),
      VarianteBoton.ghost => (Colors.transparent, C.primary, Colors.transparent),
      VarianteBoton.light => (Colors.white, C.navy, Colors.white),
    };
    final (alto, radio, letra) = switch (tamano) {
      TamanoBoton.sm => (38.0, R.sm, inter(size: 14, weight: FontWeight.w600, color: fg)),
      TamanoBoton.md => (50.0, R.md, inter(size: 16, weight: FontWeight.w600, color: fg)),
      TamanoBoton.lg => (58.0, R.lg, inter(size: 17, weight: FontWeight.w700, color: fg)),
    };
    final tamIcono = tamano == TamanoBoton.sm ? 16.0 : 19.0;
    final inactivo = deshabilitado || cargando || onPressed == null;

    return Opacity(
      opacity: inactivo && !cargando ? 0.5 : 1,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radio),
          boxShadow: variante == VarianteBoton.primary && !inactivo ? Sombra.sm : null,
        ),
        child: Material(
          color: bg,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radio), side: BorderSide(color: borde, width: 1.5)),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: inactivo ? null : onPressed,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: alto),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: tamano == TamanoBoton.sm ? 12 : 16),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: cargando
                      ? [SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: fg))]
                      : separados([
                          if (icono != null) Icon(icono, size: tamIcono, color: fg),
                          if (titulo != null)
                            Flexible(child: Text(titulo!, style: letra, textAlign: TextAlign.center)),
                          if (iconoDerecha != null) Icon(iconoDerecha, size: tamIcono, color: fg),
                        ], 8, vertical: false),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Botón solo con ícono (requiere etiqueta accesible).
class BotonIcono extends StatelessWidget {
  const BotonIcono({super.key, required this.icono, required this.etiqueta, this.onPressed, this.color = C.textMuted, this.tamano = 22});
  final IconData icono;
  final String etiqueta;
  final VoidCallback? onPressed;
  final Color color;
  final double tamano;

  @override
  Widget build(BuildContext context) =>
      IconButton(onPressed: onPressed, tooltip: etiqueta, icon: Icon(icono, size: tamano, color: color));
}

/* ----------------------------------------------------------------- Input */

/// Campo de texto controlado por [valor]: si el valor cambia desde fuera, el campo se actualiza.
class Campo extends StatefulWidget {
  const Campo({
    super.key,
    this.etiqueta,
    required this.valor,
    required this.onChanged,
    this.error,
    this.ayuda,
    this.secreto = false,
    this.multilinea = false,
    this.icono,
    this.valido = false,
    this.placeholder,
    this.teclado,
    this.autofill,
    this.accion,
    this.onSubmitted,
    this.focusNode,
    this.maxLength,
    this.estiloTexto,
    this.mayusculas = TextCapitalization.sentences,
  });

  final String? etiqueta;
  final String valor;
  final ValueChanged<String> onChanged;
  final String? error;
  final String? ayuda;
  final bool secreto;
  final bool multilinea;
  final IconData? icono;
  final bool valido;
  final String? placeholder;
  final TextInputType? teclado;
  final Iterable<String>? autofill;
  final TextInputAction? accion;
  final ValueChanged<String>? onSubmitted;
  final FocusNode? focusNode;
  final int? maxLength;
  final TextStyle? estiloTexto;
  final TextCapitalization mayusculas;

  @override
  State<Campo> createState() => _CampoState();
}

class _CampoState extends State<Campo> {
  late final _controller = TextEditingController(text: widget.valor);
  bool _visible = false;

  @override
  void didUpdateWidget(covariant Campo old) {
    super.didUpdateWidget(old);
    if (widget.valor != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.valor,
        selection: TextSelection.collapsed(offset: widget.valor.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final borde = OutlineInputBorder(
      borderRadius: BorderRadius.circular(R.md),
      borderSide: BorderSide(color: widget.error != null ? C.danger : C.border, width: 1.5),
    );
    final sufijos = <Widget>[
      if (widget.valido && widget.error == null)
        const Padding(
          padding: EdgeInsets.only(right: 8),
          child: Icon(Icons.check_circle, size: 18, color: C.success, semanticLabel: 'Válido'),
        ),
      if (widget.secreto)
        IconButton(
          tooltip: _visible ? 'Ocultar contraseña' : 'Mostrar contraseña',
          onPressed: () => setState(() => _visible = !_visible),
          icon: Icon(_visible ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20, color: C.textMuted),
        ),
    ];

    return Col(gap: 6, children: [
      if (widget.etiqueta != null) Text(widget.etiqueta!, style: T.label),
      TextField(
        controller: _controller,
        focusNode: widget.focusNode,
        onChanged: widget.onChanged,
        onSubmitted: widget.onSubmitted,
        obscureText: widget.secreto && !_visible,
        keyboardType: widget.multilinea ? TextInputType.multiline : widget.teclado,
        textInputAction: widget.multilinea ? TextInputAction.newline : widget.accion,
        textCapitalization: widget.mayusculas,
        autofillHints: widget.autofill,
        maxLength: widget.maxLength,
        minLines: widget.multilinea ? 3 : 1,
        maxLines: widget.multilinea ? 8 : 1,
        style: widget.estiloTexto ?? inter(size: 16),
        decoration: InputDecoration(
          hintText: widget.placeholder,
          hintStyle: inter(size: 16, color: const Color(0xFF94A3B8)),
          counterText: '',
          filled: true,
          fillColor: C.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          prefixIcon: widget.icono != null ? Icon(widget.icono, size: 18) : null,
          prefixIconColor: WidgetStateColor.resolveWith(
              (s) => s.contains(WidgetState.focused) ? C.primary : C.textMuted),
          suffixIcon: sufijos.isEmpty ? null : Row(mainAxisSize: MainAxisSize.min, children: sufijos),
          enabledBorder: borde,
          border: borde,
          focusedBorder: borde.copyWith(
              borderSide: BorderSide(color: widget.error != null ? C.danger : C.primary, width: 1.5)),
        ),
      ),
      if (widget.error != null)
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.error, size: 15, color: C.dangerText),
          const SizedBox(width: 6),
          Expanded(child: Text(widget.error!, style: T.small.copyWith(color: C.dangerText))),
        ])
      else if (widget.ayuda != null)
        Text(widget.ayuda!, style: T.small),
    ]);
  }
}

/* ----------------------------------------------------------------- Alert */

enum Tono { info, success, warning, error }

class Aviso extends StatelessWidget {
  const Aviso({super.key, this.tono = Tono.info, this.titulo, this.mensaje, this.children = const []});
  final Tono tono;
  final String? titulo;
  final String? mensaje;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icono, colorIcono) = switch (tono) {
      Tono.info => (C.primarySoft, C.navy, Icons.info, C.primary),
      Tono.success => (C.successSoft, const Color(0xFF14532D), Icons.check_circle, C.success),
      Tono.warning => (C.warningSoft, const Color(0xFF78350F), Icons.warning_rounded, C.warningText),
      Tono.error => (C.dangerSoft, const Color(0xFF7F1D1D), Icons.error, C.danger),
    };
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(R.md)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icono, size: 20, color: colorIcono),
          const SizedBox(width: 12),
          Expanded(
            child: Col(gap: 2, children: [
              if (titulo != null) Text(titulo!, style: T.bodyStrong.copyWith(color: fg)),
              if (mensaje != null) Text(mensaje!, style: T.small.copyWith(color: fg)),
              ...children,
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Mensaje de error de formulario; no muestra nada si no hay mensaje.
class ErrorFormulario extends StatelessWidget {
  const ErrorFormulario(this.mensaje, {super.key});
  final String? mensaje;

  @override
  Widget build(BuildContext context) =>
      mensaje == null || mensaje!.isEmpty ? const SizedBox.shrink() : Aviso(tono: Tono.error, mensaje: mensaje);
}

/* ----------------------------------------------------------------- Badge */

enum TonoInsignia { info, navy, success, warning, danger, neutral }

class Insignia extends StatelessWidget {
  const Insignia(this.texto, {super.key, this.tono = TonoInsignia.neutral, this.icono, this.bg, this.fg});
  final String texto;
  final TonoInsignia tono;
  final IconData? icono;
  final Color? bg;
  final Color? fg;

  /// Tono según el valor de un rol o estado de usuario.
  static TonoInsignia tonoDe(String valor) => switch (valor) {
        'activa' => TonoInsignia.success,
        'administrador' => TonoInsignia.info,
        'inactiva' => TonoInsignia.warning,
        _ => TonoInsignia.neutral,
      };

  @override
  Widget build(BuildContext context) {
    final (fondo, frente) = switch (tono) {
      TonoInsignia.info => (C.primarySoft, C.primary),
      TonoInsignia.navy => (C.navy, Colors.white),
      TonoInsignia.success => (C.successSoft, C.successText),
      TonoInsignia.warning => (C.warningSoft, C.warningText),
      TonoInsignia.danger => (C.dangerSoft, C.dangerText),
      TonoInsignia.neutral => (C.neutralSoft, C.textMuted),
    };
    final color = fg ?? frente;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: bg ?? fondo, borderRadius: BorderRadius.circular(R.pill)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icono != null) ...[Icon(icono, size: 12, color: color), const SizedBox(width: 4)],
        Flexible(child: Text(texto, style: inter(size: 12, weight: FontWeight.w600, color: color))),
      ]),
    );
  }
}

/* ----------------------------------------------------------- ProgressBar */

class BarraProgreso extends StatelessWidget {
  const BarraProgreso({super.key, required this.valor, this.color = C.primary, this.alto = 8, this.etiqueta, this.pista = C.neutralSoft});
  final double valor;
  final Color color;
  final double alto;
  final String? etiqueta;
  final Color pista;

  @override
  Widget build(BuildContext context) {
    final v = valor.isNaN ? 0.0 : valor.clamp(0, 100) / 100;
    return Semantics(
      label: etiqueta,
      value: '${(v * 100).round()} %',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(alto / 2),
        child: LinearProgressIndicator(value: v, minHeight: alto, color: color, backgroundColor: pista),
      ),
    );
  }
}

/* --------------------------------------------------------------- Chips */

/// Selector de una opción entre varias.
class Segmentado<V> extends StatelessWidget {
  const Segmentado({super.key, this.etiqueta, required this.opciones, required this.valor, required this.onChanged});
  final String? etiqueta;
  final List<(V, String)> opciones;
  final V valor;
  final ValueChanged<V> onChanged;

  @override
  Widget build(BuildContext context) {
    return Col(gap: 6, children: [
      if (etiqueta != null) Text(etiqueta!, style: T.label),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final (v, label) in opciones)
          Semantics(
            inMutuallyExclusiveGroup: true,
            checked: v == valor,
            child: Material(
              color: v == valor ? C.primary : C.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(R.pill),
                side: BorderSide(color: v == valor ? C.primary : C.border, width: 1.5),
              ),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => onChanged(v),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (v == valor) ...[const Icon(Icons.check, size: 14, color: Colors.white), const SizedBox(width: 4)],
                    Text(label,
                        style: inter(size: 14, weight: FontWeight.w500, color: v == valor ? Colors.white : C.text)),
                  ]),
                ),
              ),
            ),
          ),
      ]),
    ]);
  }
}

/* --------------------------------------------------- Estados de pantalla */

class Cargando extends StatelessWidget {
  const Cargando({super.key, this.mensaje});
  final String? mensaje;

  @override
  Widget build(BuildContext context) => Center(
        child: Semantics(
          label: mensaje ?? 'Cargando',
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const CircularProgressIndicator(color: C.primary),
            if (mensaje != null) ...[const SizedBox(height: 12), Text(mensaje!, style: T.small)],
          ]),
        ),
      );
}

class _IconoCirculo extends StatelessWidget {
  const _IconoCirculo(this.icono, {this.bg = C.primarySoft, this.fg = C.primary});
  final IconData icono;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) => Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Icon(icono, size: 30, color: fg),
      );
}

class EstadoVacio extends StatelessWidget {
  const EstadoVacio({super.key, this.icono = Icons.auto_awesome_outlined, required this.titulo, this.mensaje, this.children = const []});
  final IconData icono;
  final String titulo;
  final String? mensaje;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(32),
        child: Col(gap: 10, cross: CrossAxisAlignment.center, children: [
          _IconoCirculo(icono),
          Text(titulo, style: T.h3, textAlign: TextAlign.center),
          if (mensaje != null) Text(mensaje!, style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
          ...children,
        ]),
      );
}

class EstadoError extends StatelessWidget {
  const EstadoError({super.key, this.mensaje = 'No fue posible cargar la información. Intenta nuevamente.', this.onRetry});
  final String mensaje;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Col(gap: 10, cross: CrossAxisAlignment.center, children: [
              const _IconoCirculo(Icons.cloud_off_outlined, bg: C.dangerSoft, fg: C.danger),
              Text('Algo salió mal', style: T.h3, textAlign: TextAlign.center),
              Text(mensaje, style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
              if (onRetry != null)
                Boton('Reintentar', icono: Icons.refresh, variante: VarianteBoton.outline, onPressed: onRetry),
            ]),
          ),
        ),
      );
}

/// Ícono dentro de un cuadro de color suave.
class IconoCaja extends StatelessWidget {
  const IconoCaja(this.icono, {super.key, this.tamano = 44, this.color = C.primary, this.fondo = C.primarySoft, this.radio = R.md});
  final IconData icono;
  final double tamano;
  final Color color;
  final Color fondo;
  final double radio;

  @override
  Widget build(BuildContext context) => Container(
        width: tamano,
        height: tamano,
        decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(radio)),
        child: Icon(icono, size: tamano * 0.5, color: color),
      );
}
