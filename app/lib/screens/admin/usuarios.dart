import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/client.dart';
import '../../state/auth.dart';
import '../../theme.dart';
import '../../util/etiquetas.dart';
import '../../widgets/avisos.dart';
import '../../widgets/ui.dart';

const _filtros = [
  ('', 'Todos'),
  ('activa', 'Activas'),
  ('inactiva', 'Inactivas'),
  ('eliminada', 'Eliminadas'),
];

String _capital(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

class AdminUsuarios extends StatefulWidget {
  const AdminUsuarios({super.key});

  @override
  State<AdminUsuarios> createState() => _AdminUsuariosState();
}

class _AdminUsuariosState extends State<AdminUsuarios> {
  String _buscar = '';
  String _estado = '';
  List<Json> _datos = [];
  int _total = 0;
  int _pagina = 1;
  int _paginas = 1;
  bool _cargando = true;
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

  Future<void> _cargar([int pagina = 1]) async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final r = await Api.get('/users',
          query: {'pagina': pagina, 'limite': 20, 'buscar': _buscar.trim(), 'estado': _estado}) as Json;
      if (!mounted) return;
      final nuevos = (r['datos'] as List).cast<Json>();
      setState(() {
        _datos = pagina == 1 ? nuevos : [..._datos, ...nuevos];
        _total = r['total'] as int;
        _pagina = r['pagina'] as int;
        _paginas = r['paginas'] as int;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  /// Búsqueda con espera breve para no consultar en cada tecla.
  void _alBuscar(String v) {
    _buscar = v;
    _espera?.cancel();
    _espera = Timer(const Duration(milliseconds: 350), _cargar);
  }

  /// Abre otra pantalla y recarga al volver de crear/editar.
  Future<void> _ir(String ruta) async {
    await context.push(ruta);
    if (mounted) _cargar();
  }

  Future<void> _eliminar(Json u) async {
    if (!await confirmar(context,
        titulo: 'Eliminar usuario',
        mensaje: '¿Eliminar a ${u['nombre']}? Su historial se conserva y podrás restaurarlo después.',
        textoConfirmar: 'Eliminar',
        peligro: true)) {
      return;
    }
    try {
      await Api.delete('/users/${u['id']}');
      avisoExito('Usuario eliminado');
      _cargar();
    } on ApiError catch (e) {
      avisoError(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final yo = context.read<Auth>().id;
    return Pantalla(
      maxWidth: 720,
      gap: 12,
      onRefresh: _cargar,
      children: [
        Boton('Nuevo usuario', icono: Icons.person_add_alt_outlined, onPressed: () => _ir('/admin/usuarios/nuevo')),
        Campo(
          placeholder: 'Buscar por nombre o correo',
          icono: Icons.search,
          valor: _buscar,
          mayusculas: TextCapitalization.none,
          onChanged: _alBuscar,
        ),
        Segmentado<String>(
          opciones: _filtros,
          valor: _estado,
          onChanged: (v) {
            setState(() => _estado = v);
            _cargar();
          },
        ),
        ErrorFormulario(_error),
        Text('$_total usuario(s)', style: T.caption),
        if (!_cargando && _datos.isEmpty)
          const EstadoVacio(titulo: 'Sin resultados', mensaje: 'No hay usuarios con estos criterios.'),
        for (final u in _datos)
          Tarjeta(
            child: Col(gap: 12, children: [
              Col(gap: 4, children: [
                Row(children: [
                  Expanded(child: Text('${u['nombre']}', style: T.h3, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Text('#${u['id']}', style: T.small),
                ]),
                Text('${u['correo']}', style: T.small, maxLines: 1, overflow: TextOverflow.ellipsis),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Insignia(u['rol'] == 'administrador' ? 'Admin' : 'Usuario', tono: Insignia.tonoDe('${u['rol']}')),
                    Insignia(_capital('${u['estado']}'), tono: Insignia.tonoDe('${u['estado']}')),
                    Text('${u['intentos_finalizados']} simulaciones · desde ${fecha(u['fecha_registro'])}', style: T.caption),
                  ]),
                ),
              ]),
              Row(children: separados([
                Expanded(
                  child: Boton('Ver / Editar',
                      tamano: TamanoBoton.sm, variante: VarianteBoton.secondary, onPressed: () => _ir('/admin/usuarios/${u['id']}')),
                ),
                if (u['estado'] != 'eliminada' && u['id'] != yo)
                  Expanded(
                    child: Boton('Eliminar', tamano: TamanoBoton.sm, variante: VarianteBoton.danger, onPressed: () => _eliminar(u)),
                  ),
              ], 8, vertical: false)),
            ]),
          ),
        if (_cargando)
          const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
        else if (_pagina < _paginas)
          Boton('Cargar más', variante: VarianteBoton.ghost, onPressed: () => _cargar(_pagina + 1)),
      ],
    );
  }
}
