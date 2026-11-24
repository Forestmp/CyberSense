import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/client.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/avisos.dart';
import '../widgets/comunes.dart';
import '../widgets/contenido_simulado.dart';
import '../widgets/ui.dart';

const letras = 'ABCDEFGH';

/// Escenario: introducción → decisiones paso a paso → evaluación.
/// No se indica si una decisión fue correcta hasta el resultado final.
class Simulacion extends StatefulWidget {
  const Simulacion({super.key, required this.escenarioId});
  final int escenarioId;

  @override
  State<Simulacion> createState() => _SimulacionState();
}

class _SimulacionState extends State<Simulacion> {
  final _scroll = ScrollController();
  Json? _escenario;
  Json? _intento;
  Json? _paso;
  int? _seleccion;
  bool _enviando = false;
  bool _evaluando = false;
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
      final r = await Api.get('/scenarios/${widget.escenarioId}');
      if (mounted) setState(() => _escenario = r['escenario'] as Json);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _comenzar() async {
    setState(() => _enviando = true);
    try {
      final r = await Api.post('/attempts', {'escenario_id': widget.escenarioId});
      setState(() {
        _intento = r['intento'] as Json;
        _paso = r['paso'] as Json?;
      });
    } on ApiError catch (e) {
      avisoError(e.message);
      // RN-13: lleva al usuario a la retroalimentación que tiene pendiente.
      final pendiente = e.details is Map ? e.details['intento_id'] : null;
      if (e.code == 'RETROALIMENTACION_PENDIENTE' && pendiente != null && mounted) {
        context.pushReplacement('/retroalimentacion/$pendiente');
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _confirmar() async {
    if (_seleccion == null) return;
    final intentoId = _intento!['id'];
    setState(() => _enviando = true);
    try {
      final r = await Api.post('/attempts/$intentoId/responses', {'opcion_id': _seleccion});
      setState(() {
        _intento = r['intento'] as Json;
        _seleccion = null;
      });
      if (r['paso'] != null) {
        setState(() => _paso = r['paso'] as Json);
        _scroll.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      } else {
        setState(() => _evaluando = true);
        await Api.post('/attempts/$intentoId/finish');
        if (mounted) context.pushReplacement('/resultado/$intentoId');
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _evaluando = false);
      avisoError('No fue posible registrar tu decisión. ${e.message}');
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final e = _escenario;
    final titulo = e == null
        ? 'Simulación'
        : _intento != null
            ? '${e['codigo']} · Decisión ${(_intento!['decisiones_tomadas'] as int) + 1}'
            : '${e['codigo']}';
    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: SafeArea(top: false, child: _cuerpo()),
    );
  }

  Widget _cuerpo() {
    if (_evaluando) return const Cargando(mensaje: 'Evaluando tus decisiones…');
    if (_error != null) {
      return EstadoError(mensaje: 'No fue posible cargar el escenario. Intenta nuevamente.', onRetry: _cargar);
    }
    if (_escenario == null) return const Cargando();

    return SingleChildScrollView(
      controller: _scroll,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Col(gap: 16, children: [
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.pill)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.verified_user, size: 16, color: C.primary),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text('Simulación educativa · todo el contenido es ficticio',
                        style: inter(size: 12, weight: FontWeight.w600, color: C.navy)),
                  ),
                ]),
              ),
              if (_intento == null) ..._introduccion() else if (_paso != null) ..._decision(),
            ]),
          ),
        ),
      ),
    );
  }

  List<Widget> _introduccion() {
    final e = _escenario!;
    final tipo = tipoInfo(e['tipo']);
    final contexto = (e['contenido'] as Json?)?['contexto'];
    return [
      Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Col(gap: 12, cross: CrossAxisAlignment.center, children: [
          IconoCaja(tipo.icon, tamano: 64, radio: 20),
          Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, children: [
            Insignia('${e['tipo_nombre']}', tono: TonoInsignia.info, icono: tipo.icon),
            Dificultad(clave: e['dificultad'], nombre: e['dificultad_nombre']),
          ]),
          Text('${e['titulo']}', style: T.h1, textAlign: TextAlign.center),
          Text('${e['descripcion']}', style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
        ]),
      ),
      if (contexto != null)
        Tarjeta(
          child: Col(gap: 8, children: [
            Text('LA SITUACIÓN', style: T.overline),
            Text('$contexto', style: T.body),
          ]),
        ),
      Tarjeta(
        variante: VarianteTarjeta.suave,
        elevada: false,
        child: Col(gap: 10, children: [
          Text('Antes de empezar', style: T.h3.copyWith(color: C.navy)),
          for (final (icono, texto) in const [
            (Icons.person_outline, 'Decide como lo harías en la vida real.'),
            (Icons.account_tree_outlined, 'Puede haber varias decisiones encadenadas.'),
            (Icons.visibility_off_outlined, 'No sabrás si acertaste hasta el final.'),
          ])
            Row(children: [
              Icon(icono, size: 18, color: C.primary),
              const SizedBox(width: 10),
              Expanded(child: Text(texto, style: T.body)),
            ]),
        ]),
      ),
      Boton('Comenzar escenario', tamano: TamanoBoton.lg, icono: Icons.play_arrow, cargando: _enviando, onPressed: _comenzar),
    ];
  }

  List<Widget> _decision() {
    final paso = _paso!;
    final opciones = (paso['opciones'] as List).cast<Json>();
    return [
      Col(gap: 4, children: [
        Text('DECISIÓN ${(_intento!['decisiones_tomadas'] as int) + 1}', style: T.overline.copyWith(color: C.primary)),
        Text('${paso['titulo']}', style: T.h2),
      ]),
      ContenidoSimulado(paso['contenido'] as Json?),
      Padding(padding: const EdgeInsets.only(top: 8), child: Text('${paso['pregunta']}', style: T.h2)),
      Col(gap: 10, children: [
        for (final (i, o) in opciones.indexed) OpcionRespuesta(
          letra: letras[i],
          texto: '${o['texto']}',
          activa: _seleccion == o['id'],
          onTap: () => setState(() => _seleccion = o['id'] as int),
        ),
      ]),
      const Aviso(mensaje: 'Tu decisión se registrará y continuarás con el escenario. Verás la evaluación al terminar.'),
      Boton('Confirmar decisión',
          tamano: TamanoBoton.lg,
          iconoDerecha: Icons.arrow_forward,
          cargando: _enviando,
          deshabilitado: _seleccion == null,
          onPressed: _confirmar),
    ];
  }
}

/// Opción de respuesta seleccionable (simulaciones y examen diagnóstico).
class OpcionRespuesta extends StatelessWidget {
  const OpcionRespuesta({super.key, required this.letra, required this.texto, required this.activa, required this.onTap});
  final String letra;
  final String texto;
  final bool activa;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        inMutuallyExclusiveGroup: true,
        checked: activa,
        label: texto,
        excludeSemantics: true,
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(R.lg), boxShadow: Sombra.sm),
          child: Material(
            color: activa ? C.primarySoft : C.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(R.lg),
              side: BorderSide(color: activa ? C.primary : C.border, width: 1.5),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(children: [
                  Container(
                    width: 30,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: activa ? C.primary : C.bg,
                      border: Border.all(color: activa ? C.primary : C.border, width: 1.5),
                    ),
                    child: activa
                        ? const Icon(Icons.check, size: 16, color: Colors.white)
                        : Text(letra, style: inter(size: 13, weight: FontWeight.w700, color: C.textMuted)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(texto,
                        style: activa ? T.body.copyWith(fontWeight: FontWeight.w600, color: C.navy) : T.body),
                  ),
                ]),
              ),
            ),
          ),
        ),
      );
}
