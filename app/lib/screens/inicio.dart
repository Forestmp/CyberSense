import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../state/auth.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/comunes.dart';
import '../widgets/ui.dart';

String _saludo() {
  final h = DateTime.now().hour;
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

class Inicio extends StatefulWidget {
  const Inicio({super.key});

  @override
  State<Inicio> createState() => _InicioState();
}

class _InicioState extends State<Inicio> {
  Json? _metricas;
  Json? _ultima;
  Json? _recomendacion;
  Json? _examen;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    final id = context.read<Auth>().id;
    setState(() => _error = null);
    try {
      final r = await Future.wait([
        Api.get('/users/$id/metrics'),
        Api.get('/users/$id/history', query: {'limite': 1}),
        Api.get('/scenarios/recommended'),
        Api.get('/diagnostic'),
      ]);
      if (!mounted) return;
      final historial = r[1]['datos'] as List;
      setState(() {
        _metricas = r[0] as Json;
        _ultima = historial.isEmpty ? null : historial.first as Json;
        _recomendacion = r[2]['recomendacion'] as Json?;
        _examen = r[3]['examen'] as Json?;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  /// Abre otra pantalla y recarga al volver (los datos pueden haber cambiado).
  Future<void> _abrir(String ruta) async {
    await context.push(ruta);
    if (mounted) _cargar();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<Auth>();
    if (_metricas == null && _error == null) return const Cargando();
    if (_metricas == null) {
      return EstadoError(mensaje: 'No fue posible cargar tu información. Intenta nuevamente.', onRetry: _cargar);
    }

    final resumen = _metricas!['resumen'] as Json;
    final disponibles = numero(resumen['escenarios_disponibles']);
    final completados = numero(resumen['escenarios_completados']);
    final progreso = disponibles > 0 ? completados / disponibles * 100 : 0.0;
    final nivel = nivelInfo(resumen['nivel_vulnerabilidad']);
    final evaluado = resumen['nivel_vulnerabilidad'] != null;
    final heroTexto = inter(size: 13, height: 18, color: const Color(0xFFCBD5E1));

    return Pantalla(
      onRefresh: _cargar,
      children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Marca(tamano: 30),
          if (auth.esAdmin) const Insignia('Admin', tono: TonoInsignia.info, icono: Icons.key_outlined),
        ]),
        Col(gap: 2, children: [
          Text('${_saludo()},', style: T.small),
          Text(auth.nombre.split(' ').first, style: T.display),
        ]),

        // Tarjeta destacada: estado actual + acción principal
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.xl),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0B1F4D), Color(0xFF143A86)],
            ),
          ),
          child: Col(gap: 16, children: [
            Row(children: [
              Expanded(
                child: Col(gap: 4, children: [
                  Text('TU NIVEL DE VULNERABILIDAD',
                      style: inter(size: 11, weight: FontWeight.w700, letterSpacing: 1, color: const Color(0xFF93C5FD))),
                  Row(children: [
                    Icon(nivel.icon, size: 24, color: evaluado ? Colors.white : const Color(0xFF93C5FD)),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(evaluado ? nivel.label : 'Aún sin evaluar',
                          style: inter(size: 22, weight: FontWeight.w700, color: Colors.white)),
                    ),
                  ]),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(color: const Color(0x14FFFFFF), borderRadius: BorderRadius.circular(R.lg)),
                child: Column(children: [
                  Text(puntos(resumen['puntaje_promedio']), style: inter(size: 26, weight: FontWeight.w800, color: Colors.white)),
                  Text('promedio', style: inter(size: 11, weight: FontWeight.w500, color: const Color(0xFFBFDBFE))),
                ]),
              ),
            ]),
            Col(gap: 6, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('Progreso general', style: heroTexto),
                Text('${completados.toInt()} de ${disponibles.toInt()} escenarios', style: heroTexto),
              ]),
              BarraProgreso(valor: progreso, color: C.cyan, pista: const Color(0x2EFFFFFF), etiqueta: 'Progreso general'),
            ]),
            Boton('Iniciar simulación',
                tamano: TamanoBoton.lg,
                variante: VarianteBoton.light,
                icono: Icons.play_arrow,
                onPressed: () => context.go('/simulaciones')),
            if (_recomendacion != null)
              Text.rich(TextSpan(style: heroTexto, children: [
                TextSpan(text: 'Sugerido: ', style: inter(size: 13, weight: FontWeight.w600, color: Colors.white)),
                TextSpan(text: '${_recomendacion!['escenario']['titulo']} · ${_recomendacion!['motivo']}'),
              ]))
            else if (completados > 0)
              Text('Completaste todos los escenarios disponibles. Pronto habrá nuevos.', style: heroTexto),
          ]),
        ),

        if (_examen?['estado'] != 'finalizado')
          Tarjeta(
            borde: const BorderSide(color: C.primary, width: 1.5),
            child: Col(gap: 12, children: [
              Row(children: [
                const IconoCaja(Icons.quiz_outlined),
                const SizedBox(width: 12),
                Expanded(
                  child: Col(gap: 2, cross: CrossAxisAlignment.start, children: [
                    Text(_examen == null ? 'Haz tu examen diagnóstico' : 'Continúa tu examen diagnóstico', style: T.h3),
                    Text(
                        _examen == null
                            ? '15 preguntas para saber qué engaños se te dificultan más.'
                            : 'Llevas ${_examen!['respondidas']} de ${_examen!['total']} preguntas.',
                        style: T.small),
                  ]),
                ),
              ]),
              Boton(_examen == null ? 'Comenzar' : 'Continuar',
                  iconoDerecha: Icons.arrow_forward, onPressed: () => _abrir('/diagnostico')),
            ]),
          ),

        const TituloSeccion('Última simulación'),
        if (_ultima != null)
          Tarjeta(
            onTap: () => _abrir('/resultado/${_ultima!['intento_id']}'),
            semantica: 'Última simulación: ${_ultima!['titulo']}',
            child: Row(children: [
              IconoCaja(tipoInfo(_ultima!['tipo']).icon),
              const SizedBox(width: 12),
              Expanded(
                child: Col(gap: 3, cross: CrossAxisAlignment.start, children: [
                  Text('${_ultima!['titulo']}', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${_ultima!['tipo_nombre']} · ${fechaHora(_ultima!['fecha_fin'])}', style: T.small),
                  NivelBadge(_ultima!['nivel_vulnerabilidad'], prefijo: ''),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(puntos(_ultima!['puntaje']), style: inter(size: 24, weight: FontWeight.w800, color: C.navy)),
                Text('/ 100', style: T.caption),
              ]),
            ]),
          )
        else
          Tarjeta(
            variante: VarianteTarjeta.suave,
            elevada: false,
            child: Row(children: [
              const Icon(Icons.rocket_launch_outlined, size: 24, color: C.primary),
              const SizedBox(width: 12),
              Expanded(
                  child: Text('Aún no realizas simulaciones. Comienza con el escenario sugerido.', style: T.body)),
            ]),
          ),

        const TituloSeccion('Accesos'),
        _Cuadricula([
          _Acceso(Icons.bar_chart_outlined, 'Mi progreso', 'Desempeño por tipo de ataque', () => context.go('/progreso')),
          _Acceso(Icons.history, 'Historial', 'Simulaciones realizadas', () => context.go('/historial')),
          _Acceso(Icons.menu_book_outlined, 'Aprender', 'Señales de alerta y buenas prácticas', () => _abrir('/aprender')),
          _Acceso(Icons.account_circle_outlined, 'Perfil', 'Tu cuenta y contraseña', () => context.go('/perfil')),
          if (_examen?['estado'] == 'finalizado')
            _Acceso(Icons.quiz_outlined, 'Mi diagnóstico', 'Resultado de tu examen inicial', () => _abrir('/diagnostico')),
        ]),

        if (auth.esAdmin) ...[
          const TituloSeccion('Administración'),
          _Cuadricula([
            _Acceso(Icons.layers_outlined, 'Escenarios', 'Crear, editar y desactivar', () => _abrir('/admin/escenarios')),
            _Acceso(Icons.people_outline, 'Usuarios', 'Cuentas y roles', () => _abrir('/admin/usuarios')),
          ]),
        ],
      ],
    );
  }
}

class _Acceso extends StatelessWidget {
  const _Acceso(this.icono, this.titulo, this.descripcion, this.onTap);
  final IconData icono;
  final String titulo;
  final String descripcion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Tarjeta(
        onTap: onTap,
        semantica: titulo,
        child: Col(gap: 6, cross: CrossAxisAlignment.start, children: [
          IconoCaja(icono),
          Text(titulo, style: T.h3),
          Text(descripcion, style: T.small, maxLines: 2, overflow: TextOverflow.ellipsis),
        ]),
      );
}

/// Dos columnas de accesos del mismo alto por fila.
class _Cuadricula extends StatelessWidget {
  const _Cuadricula(this.items);
  final List<Widget> items;

  @override
  Widget build(BuildContext context) => Col(gap: 12, children: [
        for (var i = 0; i < items.length; i += 2)
          IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Expanded(child: items[i]),
              const SizedBox(width: 12),
              Expanded(child: i + 1 < items.length ? items[i + 1] : const SizedBox()),
            ]),
          ),
      ]);
}
