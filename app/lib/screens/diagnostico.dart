import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/client.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/avisos.dart';
import '../widgets/comunes.dart';
import '../widgets/contenido_simulado.dart';
import '../widgets/ui.dart';
import 'simulacion.dart' show OpcionRespuesta, letras;

/// Examen diagnóstico (RF-22, RN-22): introducción → 15 preguntas → resultado.
/// Se presenta una sola vez; el resultado es la primera evaluación del usuario.
class Diagnostico extends StatefulWidget {
  const Diagnostico({super.key});

  @override
  State<Diagnostico> createState() => _DiagnosticoState();
}

class _DiagnosticoState extends State<Diagnostico> {
  final _scroll = ScrollController();
  Json? _estado;
  int? _seleccion;
  bool _enviando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _cargar() async {
    setState(() => _error = null);
    try {
      final r = await Api.get('/diagnostic') as Json;
      if (mounted) setState(() => _estado = r);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _enviar(Future<dynamic> Function() peticion) async {
    setState(() => _enviando = true);
    try {
      final r = await peticion() as Json;
      setState(() {
        _estado = r;
        _seleccion = null;
      });
      if (_scroll.hasClients) _scroll.jumpTo(0);
    } on ApiError catch (e) {
      avisoError(e.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final examen = _estado?['examen'] as Json?;
    final enCurso = _estado?['pregunta'] != null;
    final titulo = enCurso ? 'Pregunta ${examen!['respondidas'] + 1} de ${examen['total']}' : 'Examen diagnóstico';
    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: SafeArea(top: false, child: _cuerpo()),
    );
  }

  Widget _cuerpo() {
    if (_error != null) return EstadoError(onRetry: _cargar);
    if (_estado == null) return const Cargando();
    final hijos = _estado!['resultado'] != null
        ? _resultado(_estado!['resultado'] as Json)
        : _estado!['pregunta'] != null
            ? _pregunta(_estado!['examen'] as Json, _estado!['pregunta'] as Json)
            : _introduccion();
    return SingleChildScrollView(
      controller: _scroll,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Padding(padding: const EdgeInsets.all(20), child: Col(gap: 16, children: hijos)),
        ),
      ),
    );
  }

  List<Widget> _introduccion() => [
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Col(gap: 12, cross: CrossAxisAlignment.center, children: [
            const IconoCaja(Icons.quiz_outlined, tamano: 64, radio: 20),
            Text('Examen diagnóstico', style: T.h1, textAlign: TextAlign.center),
            Text('Descubre qué tipos de engaño se te dificultan más para que CyberSense te recomiende qué practicar.',
                style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
          ]),
        ),
        Tarjeta(
          variante: VarianteTarjeta.suave,
          elevada: false,
          child: Col(gap: 10, children: [
            Text('Antes de empezar', style: T.h3.copyWith(color: C.navy)),
            for (final (icono, texto) in const [
              (Icons.format_list_numbered, '15 preguntas, una por cada tipo de engaño.'),
              (Icons.person_outline, 'Responde como lo harías en la vida real.'),
              (Icons.visibility_off_outlined, 'Verás tus resultados al terminar.'),
              (Icons.looks_one_outlined, 'Solo se presenta una vez. Si sales, puedes continuar después.'),
            ])
              Row(children: [
                Icon(icono, size: 18, color: C.primary),
                const SizedBox(width: 10),
                Expanded(child: Text(texto, style: T.body)),
              ]),
          ]),
        ),
        Boton('Comenzar examen',
            tamano: TamanoBoton.lg,
            icono: Icons.play_arrow,
            cargando: _enviando,
            onPressed: () => _enviar(() => Api.post('/diagnostic/start'))),
      ];

  List<Widget> _pregunta(Json examen, Json pregunta) {
    final opciones = (pregunta['opciones'] as List).cast<Json>();
    final respondidas = examen['respondidas'] as int;
    final total = examen['total'] as int;
    return [
      BarraProgreso(valor: respondidas / total * 100, etiqueta: 'Avance del examen'),
      Text('${pregunta['enunciado']}', style: T.h2),
      ContenidoSimulado(pregunta['contenido'] as Json?),
      Col(gap: 10, children: [
        for (final (i, o) in opciones.indexed)
          OpcionRespuesta(
            letra: letras[i],
            texto: '${o['texto']}',
            activa: _seleccion == o['id'],
            onTap: () => setState(() => _seleccion = o['id'] as int),
          ),
      ]),
      Boton(respondidas + 1 == total ? 'Terminar examen' : 'Siguiente pregunta',
          tamano: TamanoBoton.lg,
          iconoDerecha: Icons.arrow_forward,
          cargando: _enviando,
          deshabilitado: _seleccion == null,
          onPressed: () => _enviar(() => Api.post('/diagnostic/answers', {'opcion_id': _seleccion}))),
    ];
  }

  List<Widget> _resultado(Json resultado) {
    final respuestas = (resultado['respuestas'] as List).cast<Json>();
    final puntaje = numero(resultado['puntaje']);
    final seguras = respuestas.where((r) => numero(r['puntuacion']) == 1).length;
    return [
      Tarjeta(
        child: Col(gap: 8, cross: CrossAxisAlignment.center, children: [
          Text('TU RESULTADO', style: T.overline),
          Text(puntos(puntaje), style: T.display),
          NivelBadge(nivelDePuntaje(puntaje), grande: true),
          Text('Elegiste la opción más segura en $seguras de ${respuestas.length} situaciones.',
              style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
        ]),
      ),
      const Aviso(
          mensaje: 'Con este resultado CyberSense estima en qué tipos de engaño tienes más probabilidad de equivocarte '
              'y te recomendará practicar primero esos.'),
      const TituloSeccion('Revisa cada situación'),
      for (final r in respuestas) _Revision(r),
      Boton('Ir al inicio', tamano: TamanoBoton.lg, onPressed: () => context.go('/')),
    ];
  }
}

/// Una respuesta del examen: qué elegiste, la opción más segura y las señales de alerta.
class _Revision extends StatelessWidget {
  const _Revision(this.r);
  final Json r;

  @override
  Widget build(BuildContext context) {
    final p = numero(r['puntuacion']);
    final v = p == 1
        ? valoraciones['correcta']!
        : p >= 0.5
            ? valoraciones['mejorable']!
            : valoraciones['incorrecta']!;
    final senales = (r['senales'] as List? ?? const []).cast<String>();
    return Acordeon(
      icono: v.icon!,
      colorIcono: v.fg,
      titulo: '${r['orden']}. ${r['subcategoria_nombre']}',
      children: [
        Align(alignment: Alignment.centerLeft, child: Insignia(v.label, bg: v.bg, fg: v.fg, icono: v.icon)),
        Text('Tu respuesta', style: T.label),
        Text('${r['opcion_elegida']}', style: T.body),
        if (p < 1) ...[
          Text('La opción más segura', style: T.label),
          Text('${r['opcion_segura']}', style: T.body),
        ],
        if (senales.isNotEmpty) ...[
          Text('Señales de alerta', style: T.label),
          for (final s in senales)
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Padding(
                padding: EdgeInsets.only(top: 3),
                child: Icon(Icons.flag_outlined, size: 16, color: C.warningText),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(s, style: T.body)),
            ]),
        ],
      ],
    );
  }
}
