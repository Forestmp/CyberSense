/// Retroalimentación de acciones: avisos breves (toast) y confirmaciones en un
/// diálogo propio.
///   avisoExito('Escenario guardado correctamente');
///   if (await confirmar(context, titulo: 'Eliminar', mensaje: '…', textoConfirmar: 'Eliminar', peligro: true)) …
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'ui.dart';

/// Llave del ScaffoldMessenger de la app: los avisos sobreviven a la navegación.
final avisosKey = GlobalKey<ScaffoldMessengerState>();

void _mostrar(String mensaje, IconData icono, Color color, Duration duracion) {
  final messenger = avisosKey.currentState;
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      behavior: SnackBarBehavior.floating,
      backgroundColor: C.surface,
      elevation: 6,
      duration: duracion,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(R.md),
        side: BorderSide(color: color.withValues(alpha: 0.35)),
      ),
      content: Semantics(
        liveRegion: true,
        child: Row(children: [
          Icon(icono, color: color, size: 22),
          const SizedBox(width: 12),
          Expanded(child: Text(mensaje, style: T.bodyStrong)),
        ]),
      ),
    ));
}

void avisoExito(String m) => _mostrar(m, Icons.check_circle, C.success, const Duration(milliseconds: 2800));
void avisoError(String m) => _mostrar(m, Icons.error, C.danger, const Duration(milliseconds: 4500));
void avisoInfo(String m) => _mostrar(m, Icons.info, C.primary, const Duration(milliseconds: 2800));

/// Diálogo con ícono, título, mensaje, contenido opcional y acciones apiladas.
class Dialogo extends StatelessWidget {
  const Dialogo({super.key, this.titulo, this.mensaje, this.icono, this.colorIcono = C.primary, this.child, this.acciones = const []});
  final String? titulo;
  final String? mensaje;
  final IconData? icono;
  final Color colorIcono;
  final Widget? child;
  final List<Widget> acciones;

  @override
  Widget build(BuildContext context) => Dialog(
        backgroundColor: C.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.xl)),
        insetPadding: const EdgeInsets.all(20),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Col(gap: 12, cross: CrossAxisAlignment.center, children: [
              if (icono != null)
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(color: colorIcono.withValues(alpha: 0.1), shape: BoxShape.circle),
                  child: Icon(icono, size: 26, color: colorIcono),
                ),
              if (titulo != null) Text(titulo!, style: T.h2, textAlign: TextAlign.center),
              if (mensaje != null) Text(mensaje!, style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
              if (child != null) child!,
              if (acciones.isNotEmpty)
                Padding(padding: const EdgeInsets.only(top: 8), child: Col(gap: 8, children: acciones)),
            ]),
          ),
        ),
      );
}

Future<bool> confirmar(
  BuildContext context, {
  required String titulo,
  required String mensaje,
  String textoConfirmar = 'Aceptar',
  bool peligro = false,
}) async {
  final r = await showDialog<bool>(
    context: context,
    barrierColor: const Color(0x730B1F4D),
    builder: (ctx) => Dialogo(
      titulo: titulo,
      mensaje: mensaje,
      icono: peligro ? Icons.warning_amber_rounded : Icons.help_outline,
      colorIcono: peligro ? C.danger : C.primary,
      acciones: [
        Boton(textoConfirmar,
            variante: peligro ? VarianteBoton.dangerSolid : VarianteBoton.primary,
            onPressed: () => Navigator.pop(ctx, true)),
        Boton('Cancelar', variante: VarianteBoton.ghost, onPressed: () => Navigator.pop(ctx, false)),
      ],
    ),
  );
  return r ?? false;
}
