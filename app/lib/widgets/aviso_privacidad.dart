/// Aviso de privacidad simplificado (RN-23) y casillas de aceptación del registro.
library;

import 'package:flutter/material.dart';

import '../theme.dart';
import 'avisos.dart';
import 'ui.dart';

const _secciones = [
  ('Responsable',
      'El equipo del Trabajo Terminal 2027-A087 de la Escuela Superior de Cómputo del Instituto Politécnico Nacional es responsable del tratamiento de tus datos personales en CyberSense.'),
  ('Datos que se recaban',
      'Tu nombre, tu correo electrónico, tu contraseña (que se guarda cifrada) y las respuestas y resultados de tus simulaciones y de tu examen diagnóstico.'),
  ('Finalidades',
      'Crear y administrar tu cuenta, evaluar tus decisiones, mostrarte tu progreso y recomendarte simulaciones. Tus resultados, sin tu nombre ni tu correo, se usan para entrenar y evaluar el modelo que estima tu probabilidad de error.'),
  ('Transferencias', 'Tus datos no se venden ni se comparten con terceros.'),
  ('Tus derechos',
      'Puedes acceder a tus datos, corregirlos desde tu perfil y solicitar al administrador la cancelación de tu cuenta. Al cancelarla se eliminan tu nombre y tu correo, y tus resultados se conservan sin datos que te identifiquen.'),
  ('Edad', 'CyberSense es solo para personas mayores de 18 años.'),
];

Future<void> verAvisoPrivacidad(BuildContext context) => showDialog<void>(
      context: context,
      builder: (ctx) => Dialogo(
        titulo: 'Aviso de privacidad',
        icono: Icons.privacy_tip_outlined,
        acciones: [Boton('Cerrar', onPressed: () => Navigator.pop(ctx))],
        child: Col(gap: 12, children: [
          for (final (titulo, texto) in _secciones)
            Col(gap: 4, children: [
              Text(titulo, style: T.bodyStrong),
              Text(texto, style: T.body.copyWith(color: C.textMuted)),
            ]),
        ]),
      ),
    );

/// Las dos declaraciones que exige RN-23: aceptar el aviso y ser mayor de edad.
class CasillasAviso extends StatelessWidget {
  const CasillasAviso({
    super.key,
    required this.aceptaAviso,
    required this.mayorDeEdad,
    required this.onAviso,
    required this.onMayor,
    this.errorAviso,
    this.errorMayor,
  });

  final bool aceptaAviso;
  final bool mayorDeEdad;
  final ValueChanged<bool> onAviso;
  final ValueChanged<bool> onMayor;
  final String? errorAviso;
  final String? errorMayor;

  @override
  Widget build(BuildContext context) => Col(gap: 4, children: [
        _Casilla(
          valor: aceptaAviso,
          onChanged: onAviso,
          error: errorAviso,
          texto: Wrap(children: [
            Text('He leído y acepto el ', style: T.body),
            InkWell(
              onTap: () => verAvisoPrivacidad(context),
              child: Text('aviso de privacidad', style: inter(weight: FontWeight.w600, color: C.primary)),
            ),
          ]),
        ),
        _Casilla(
          valor: mayorDeEdad,
          onChanged: onMayor,
          error: errorMayor,
          texto: Text('Declaro que soy mayor de 18 años', style: T.body),
        ),
      ]);
}

class _Casilla extends StatelessWidget {
  const _Casilla({required this.valor, required this.onChanged, required this.texto, this.error});
  final bool valor;
  final ValueChanged<bool> onChanged;
  final Widget texto;
  final String? error;

  @override
  Widget build(BuildContext context) => Col(gap: 0, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Checkbox(value: valor, onChanged: (v) => onChanged(v ?? false), activeColor: C.primary),
          Expanded(child: GestureDetector(onTap: () => onChanged(!valor), child: texto)),
        ]),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(left: 48),
            child: Text(error!, style: T.small.copyWith(color: C.dangerText)),
          ),
      ]);
}
