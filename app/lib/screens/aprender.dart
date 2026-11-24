import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme.dart';
import '../widgets/comunes.dart';
import '../widgets/ui.dart';

/*
 * Contenido educativo de referencia. No existe todavía un endpoint de
 * contenidos, así que se mantiene estático en la app.
 */
class _Tema {
  const _Tema(this.icono, this.titulo, this.resumen, this.senales, this.hacer);
  final IconData icono;
  final String titulo;
  final String resumen;
  final List<String> senales;
  final List<String> hacer;
}

const _temas = [
  _Tema(
    Icons.mail_outline,
    'Phishing',
    'Correos o sitios falsos que imitan a instituciones de confianza para robar datos o provocar una acción.',
    [
      'El dominio del remitente no coincide con el oficial (p. ej. banco-seguridad.info en lugar de banco.mx).',
      'Urgencia o amenazas: «tu cuenta será bloqueada en 24 horas».',
      'Enlaces cuyo destino real no es el sitio oficial.',
      'Solicitud de contraseñas, NIP, códigos o datos de tarjeta.',
    ],
    [
      'Entra por la app o escribiendo tú mismo la dirección oficial.',
      'Reporta el correo como phishing.',
      'Ante la duda, llama al número oficial de la institución.',
    ],
  ),
  _Tema(
    Icons.sms_outlined,
    'Smishing',
    'Engaños por SMS o mensajería: paquetes retenidos, premios, cargos no reconocidos.',
    [
      'Números desconocidos o remitentes genéricos.',
      'Enlaces acortados (bit.ly, etc.) que ocultan el destino.',
      'Pagos pequeños «para liberar» un paquete o premio.',
      'Errores de ortografía o mensajes impersonales.',
    ],
    [
      'No abras enlaces de mensajes inesperados.',
      'Verifica en el sitio oficial de la paquetería o del banco.',
      'Bloquea y reporta el número.',
    ],
  ),
  _Tema(
    Icons.person_off_outlined,
    'Suplantación de identidad',
    'Alguien se hace pasar por una persona o institución de confianza: familiar, jefe, soporte técnico o banco.',
    [
      'Cambios repentinos de número o de cuenta («perdí mi celular, este es mi nuevo número»).',
      'Peticiones urgentes de dinero o de códigos de verificación.',
      'Presión para mantener el secreto o no colgar.',
      'Datos que no coinciden con lo que conoces de esa persona.',
    ],
    [
      'Confirma por otro canal (llama al número que ya tenías).',
      'Nunca compartas códigos de verificación.',
      'Haz una pregunta que solo la persona real sabría.',
    ],
  ),
];

const _reglas = [
  (Icons.pause_circle_outline, 'Detente', 'La urgencia es la herramienta favorita de los atacantes.'),
  (Icons.search, 'Verifica', 'Revisa remitente, dirección web y canal antes de actuar.'),
  (Icons.call_outlined, 'Confirma', 'Usa un canal oficial que tú elijas, no el que te enviaron.'),
  (Icons.campaign_outlined, 'Reporta', 'Reportar protege también a otras personas.'),
];

class Aprender extends StatelessWidget {
  const Aprender({super.key});

  Widget _punto(IconData icono, Color color, String texto) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(top: 3), child: Icon(icono, size: 16, color: color)),
        const SizedBox(width: 10),
        Expanded(child: Text(texto, style: T.body)),
      ]);

  Widget _regla((IconData, String, String) r) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: C.surface,
          borderRadius: BorderRadius.circular(R.lg),
          border: Border.all(color: C.border),
        ),
        child: Col(gap: 6, cross: CrossAxisAlignment.start, children: [
          Icon(r.$1, size: 22, color: C.primary),
          Text(r.$2, style: T.h3),
          Text(r.$3, style: T.small),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Pantalla(children: [
      const Subtitulo('Señales de alerta y buenas prácticas para reconocer ataques de ingeniería social.'),
      Col(gap: 12, children: [
        for (var i = 0; i < _reglas.length; i += 2)
          IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Expanded(child: _regla(_reglas[i])),
              const SizedBox(width: 12),
              Expanded(child: _regla(_reglas[i + 1])),
            ]),
          ),
      ]),
      for (final (i, t) in _temas.indexed)
        Acordeon(
          icono: t.icono,
          titulo: t.titulo,
          abiertoInicial: i == 0,
          children: [
            Text(t.resumen, style: T.body),
            Text('SEÑALES DE ALERTA', style: T.overline),
            for (final s in t.senales) _punto(Icons.flag, C.warningText, s),
            Text('QUÉ HACER', style: T.overline),
            for (final s in t.hacer) _punto(Icons.check_circle, C.success, s),
          ],
        ),
      const Aviso(
        titulo: 'Pon a prueba lo aprendido',
        mensaje: 'Las simulaciones de CyberSense te permiten practicar en un entorno seguro.',
      ),
      Boton('Ir a simulaciones', icono: Icons.play_arrow, onPressed: () => context.go('/simulaciones')),
    ]);
  }
}
