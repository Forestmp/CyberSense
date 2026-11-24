import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/client.dart';
import '../../theme.dart';
import '../../util/etiquetas.dart';
import '../../widgets/avisos.dart';
import '../../widgets/comunes.dart';
import '../../widgets/ui.dart';

const _filtros = [
  ('', 'Todos'),
  ('activo', 'Activos'),
  ('borrador', 'Borradores'),
  ('inactivo', 'Inactivos'),
  ('eliminado', 'Eliminados'),
];

class AdminEscenarios extends StatefulWidget {
  const AdminEscenarios({super.key});

  @override
  State<AdminEscenarios> createState() => _AdminEscenariosState();
}

class _AdminEscenariosState extends State<AdminEscenarios> {
  String _buscar = '';
  String _estado = '';
  List<Json>? _datos;
  String? _error;
  Timer? _espera;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  @override
  void dispose() {
    _espera?.cancel();
    super.dispose();
  }

  Future<void> _cargar() async {
    setState(() => _error = null);
    try {
      final r = await Api.get('/scenarios', query: {'limite': 100, 'buscar': _buscar.trim(), 'estado': _estado});
      if (mounted) setState(() => _datos = (r['datos'] as List).cast<Json>());
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  /// Búsqueda con espera breve para no consultar en cada tecla.
  void _alBuscar(String v) {
    _buscar = v;
    _espera?.cancel();
    _espera = Timer(const Duration(milliseconds: 350), _cargar);
  }

  Future<void> _ir(String ruta) async {
    await context.push(ruta);
    if (mounted) _cargar();
  }

  Future<void> _alternarEstado(Json e) async {
    final nuevo = e['estado'] == 'activo' ? 'inactivo' : 'activo';
    if (nuevo == 'inactivo' &&
        !await confirmar(context,
            titulo: 'Desactivar escenario',
            mensaje: '«${e['titulo']}» dejará de mostrarse a los usuarios. Podrás activarlo de nuevo.',
            textoConfirmar: 'Desactivar')) {
      return;
    }
    try {
      await Api.patch('/scenarios/${e['id']}', {'estado': nuevo});
      avisoExito(nuevo == 'activo' ? 'Escenario activado' : 'Escenario desactivado');
      _cargar();
    } on ApiError catch (err) {
      avisoError(err.message);
    }
  }

  Future<void> _eliminar(Json e) async {
    if (!await confirmar(context,
        titulo: 'Eliminar escenario',
        peligro: true,
        textoConfirmar: 'Eliminar',
        mensaje: '¿Eliminar «${e['titulo']}» (${e['codigo']})? Dejará de mostrarse, pero el historial de los usuarios se conserva.')) {
      return;
    }
    try {
      await Api.delete('/scenarios/${e['id']}');
      avisoExito('Escenario eliminado');
      _cargar();
    } on ApiError catch (err) {
      avisoError(err.message);
    }
  }

  Widget _acciones(Json e) {
    final ver = BotonIcono(
        icono: Icons.visibility_outlined, etiqueta: 'Ver ${e['titulo']}', color: C.primary, onPressed: () => _ir('/admin/escenarios/${e['id']}'));
    if (e['estado'] == 'eliminado') return ver;
    final activo = e['estado'] == 'activo';
    return Row(mainAxisSize: MainAxisSize.min, children: [
      ver,
      BotonIcono(
          icono: Icons.edit_outlined,
          etiqueta: 'Editar ${e['titulo']}',
          color: C.primary,
          onPressed: () => _ir('/admin/escenarios/${e['id']}/editar')),
      BotonIcono(
          icono: activo ? Icons.pause_circle_outline : Icons.play_circle_outline,
          etiqueta: '${activo ? 'Desactivar' : 'Activar'} ${e['titulo']}',
          color: C.warningText,
          onPressed: () => _alternarEstado(e)),
      BotonIcono(
          icono: Icons.delete_outline, etiqueta: 'Eliminar ${e['titulo']}', color: C.danger, onPressed: () => _eliminar(e)),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    if (_datos == null && _error == null) return const Cargando();
    if (_datos == null) {
      return EstadoError(mensaje: 'No fue posible cargar los escenarios. Intenta nuevamente.', onRetry: _cargar);
    }
    // La tabla necesita más ancho que el resto de las vistas de tablet por sus columnas fijas.
    final tabla = MediaQuery.sizeOf(context).width >= breakpointAncho + 232;

    return Pantalla(
      maxWidth: tabla ? 1100 : 560,
      gap: 12,
      onRefresh: _cargar,
      children: [
        Wrap(spacing: 12, runSpacing: 12, crossAxisAlignment: WrapCrossAlignment.end, children: [
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 220, maxWidth: 520),
            child: Campo(
              icono: Icons.search,
              placeholder: 'Buscar por nombre o ID (PH-001)',
              valor: _buscar,
              mayusculas: TextCapitalization.none,
              onChanged: _alBuscar,
            ),
          ),
          Boton('Nuevo escenario', icono: Icons.add, onPressed: () => _ir('/admin/escenarios/nuevo')),
        ]),
        Segmentado<String>(
          opciones: _filtros,
          valor: _estado,
          onChanged: (v) {
            setState(() => _estado = v);
            _cargar();
          },
        ),
        Text('${_datos!.length} escenario(s)', style: T.small),
        if (_datos!.isEmpty)
          const EstadoVacio(icono: Icons.layers_outlined, titulo: 'Sin escenarios', mensaje: 'No hay escenarios con estos criterios.')
        else if (tabla)
          _tabla()
        else
          for (final e in _datos!) _tarjeta(e),
      ],
    );
  }

  Widget _tarjeta(Json e) => Tarjeta(
        child: Col(gap: 10, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('${e['codigo']}', style: inter(size: 13, weight: FontWeight.w700, color: C.primary)),
            EstadoBadge(e['estado']),
          ]),
          Text('${e['titulo']}', style: T.h3),
          Row(children: [
            Text(tipoInfo(e['tipo']).label, style: T.small),
            const SizedBox(width: 12),
            Dificultad(clave: e['dificultad'], nombre: e['dificultad_nombre']),
          ]),
          Container(
            padding: const EdgeInsets.only(top: 4),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.border))),
            alignment: Alignment.centerRight,
            child: _acciones(e),
          ),
        ]),
      );

  Widget _tabla() {
    final th = inter(size: 12, weight: FontWeight.w700, color: C.navy, letterSpacing: 0.5);
    Widget fila(List<Widget> celdas, {Color color = C.surface}) => Container(
          color: color,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(children: [
            SizedBox(width: 80, child: celdas[0]),
            const SizedBox(width: 12),
            Expanded(child: celdas[1]),
            const SizedBox(width: 12),
            SizedBox(width: 170, child: celdas[2]),
            SizedBox(width: 120, child: celdas[3]),
            SizedBox(width: 110, child: celdas[4]),
            SizedBox(width: 196, child: Align(alignment: Alignment.centerRight, child: celdas[5])),
          ]),
        );
    return Container(
      decoration: BoxDecoration(border: Border.all(color: C.border), borderRadius: BorderRadius.circular(R.lg)),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        fila([
          for (final t in ['ID', 'NOMBRE', 'TIPO', 'DIFICULTAD', 'ESTADO', 'ACCIONES']) Text(t, style: th),
        ], color: C.primarySoft),
        for (final (i, e) in _datos!.indexed) ...[
          const Divider(height: 1, color: C.border),
          fila([
            Text('${e['codigo']}', style: inter(size: 14, weight: FontWeight.w700, color: C.primary)),
            Text('${e['titulo']}', style: T.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
            Text('${e['tipo_nombre']}', style: T.body),
            Align(alignment: Alignment.centerLeft, child: Dificultad(clave: e['dificultad'], nombre: e['dificultad_nombre'])),
            Align(alignment: Alignment.centerLeft, child: EstadoBadge(e['estado'])),
            _acciones(e),
          ], color: i.isOdd ? const Color(0xFFFBFCFE) : C.surface),
        ],
      ]),
    );
  }
}
