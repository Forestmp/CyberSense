import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../api/client.dart';
import '../../state/auth.dart';
import '../../theme.dart';
import '../../util/etiquetas.dart';
import '../../widgets/avisos.dart';
import '../../widgets/ui.dart';

const _roles = [('usuario', 'Usuario'), ('administrador', 'Administrador')];
const _estados = [('activa', 'Activa'), ('inactiva', 'Inactiva')];

/// Crear (sin id) o ver/editar un usuario.
class FormularioUsuario extends StatefulWidget {
  const FormularioUsuario({super.key, this.usuarioId});
  final int? usuarioId;

  @override
  State<FormularioUsuario> createState() => _FormularioUsuarioState();
}

class _FormularioUsuarioState extends State<FormularioUsuario> {
  late final bool _esNuevo = widget.usuarioId == null;
  late final Auth _auth = context.read<Auth>();
  late final bool _esPropio = !_esNuevo && widget.usuarioId == _auth.id;

  Json? _original;
  final _form = {'nombre': '', 'correo': '', 'rol': 'usuario', 'estado': 'activa', 'password': ''};
  Map<String, String> _errores = {};
  String? _error;
  late bool _cargando = !_esNuevo;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    if (!_esNuevo) _cargar();
  }

  Future<void> _cargar() async {
    try {
      final u = (await Api.get('/users/${widget.usuarioId}'))['usuario'] as Json;
      if (!mounted) return;
      setState(() {
        _original = u;
        _form
          ..['nombre'] = '${u['nombre']}'
          ..['correo'] = '${u['correo']}'
          ..['rol'] = '${u['rol']}'
          ..['estado'] = u['estado'] == 'eliminada' ? 'activa' : '${u['estado']}';
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Json _cuerpo() {
    final f = _form;
    if (_esNuevo) {
      return {
        'nombre': f['nombre']!.trim(),
        'correo': f['correo']!.trim(),
        'rol': f['rol'],
        'estado': f['estado'],
        'password': f['password'],
      };
    }
    final o = _original!;
    return {
      if (f['nombre']!.trim() != o['nombre']) 'nombre': f['nombre']!.trim(),
      if (f['correo']!.trim().toLowerCase() != o['correo']) 'correo': f['correo']!.trim(),
      if (!_esPropio && f['rol'] != o['rol']) 'rol': f['rol'],
      if (!_esPropio && f['estado'] != o['estado']) 'estado': f['estado'],
      if (f['password']!.isNotEmpty) 'password_nueva': f['password'],
    };
  }

  Future<void> _guardar() async {
    setState(() {
      _error = null;
      _errores = {};
    });
    final body = _cuerpo();
    if (!_esNuevo && body.isEmpty) {
      setState(() => _error = 'No hay cambios por guardar.');
      return;
    }
    if (_esPropio && body.containsKey('password_nueva')) {
      setState(() => _error = 'Para cambiar tu propia contraseña usa «Mi perfil».');
      return;
    }
    setState(() => _guardando = true);
    try {
      if (_esNuevo) {
        await Api.post('/users', body);
        avisoExito('Usuario creado: ${body['nombre']} ya puede iniciar sesión');
      } else {
        final r = await Api.put('/users/${widget.usuarioId}', body);
        if (_esPropio) _auth.actualizarUsuario({..._auth.usuario!, ...(r['usuario'] as Json)});
        avisoExito(_original!['estado'] == 'eliminada' ? 'Usuario restaurado correctamente' : 'Usuario actualizado correctamente');
      }
      if (mounted) context.pop();
    } on ApiError catch (e) {
      final campos = e.camposConError;
      if (campos['password_nueva'] != null) campos['password'] = campos['password_nueva']!;
      setState(() {
        _errores = campos;
        _error = e.message;
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<void> _eliminar() async {
    if (!await confirmar(context,
        titulo: 'Eliminar usuario',
        mensaje: '¿Eliminar a ${_original!['nombre']}? Su historial se conserva.',
        textoConfirmar: 'Eliminar',
        peligro: true)) {
      return;
    }
    try {
      await Api.delete('/users/${widget.usuarioId}');
      if (mounted) context.pop();
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    }
  }

  void _set(String campo, String valor) => setState(() => _form[campo] = valor);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_esNuevo ? 'Nuevo usuario' : 'Editar usuario')),
      body: SafeArea(top: false, child: _contenido()),
    );
  }

  Widget _contenido() {
    if (_cargando) return const Cargando();
    if (!_esNuevo && _original == null) {
      return Pantalla(children: [ErrorFormulario(_error ?? 'Usuario no encontrado')]);
    }
    final o = _original;
    final eliminado = o?['estado'] == 'eliminada';
    final f = _form;

    return Pantalla(children: [
      if (o != null)
        Tarjeta(
          child: Col(gap: 6, children: [
            Row(children: [
              Text('ID #${o['id']}', style: T.small),
              const SizedBox(width: 8),
              Insignia('${o['estado']}', tono: Insignia.tonoDe('${o['estado']}')),
            ]),
            Text('Registro: ${fechaHora(o['fecha_registro'])}', style: T.small),
            Text('Última actualización: ${fechaHora(o['fecha_actualizacion'])}', style: T.small),
            if (eliminado)
              Text('Eliminado el ${fechaHora(o['fecha_eliminacion'])}. Elige un estado y guarda para restaurarlo.',
                  style: T.small.copyWith(color: C.warningText)),
          ]),
        ),
      ErrorFormulario(_error),
      Campo(etiqueta: 'Nombre', valor: f['nombre']!, onChanged: (v) => _set('nombre', v), error: _errores['nombre']),
      Campo(
        etiqueta: 'Correo electrónico',
        valor: f['correo']!,
        onChanged: (v) => _set('correo', v),
        error: _errores['correo'],
        teclado: TextInputType.emailAddress,
        mayusculas: TextCapitalization.none,
      ),
      if (_esPropio)
        Text('No puedes cambiar tu propio rol ni estado.', style: T.small)
      else ...[
        Segmentado<String>(etiqueta: 'Rol', opciones: _roles, valor: f['rol']!, onChanged: (v) => _set('rol', v)),
        Segmentado<String>(
          etiqueta: eliminado ? 'Estado al restaurar' : 'Estado',
          opciones: _estados,
          valor: f['estado']!,
          onChanged: (v) => _set('estado', v),
        ),
        Campo(
          etiqueta: _esNuevo ? 'Contraseña' : 'Nueva contraseña (opcional)',
          valor: f['password']!,
          onChanged: (v) => _set('password', v),
          error: _errores['password'],
          secreto: true,
          autofill: const [AutofillHints.newPassword],
          ayuda: _esNuevo ? 'Mínimo 8 caracteres, con letras y números' : 'Déjala vacía para no cambiarla',
        ),
      ],
      Boton(_esNuevo ? 'Crear usuario' : eliminado ? 'Restaurar usuario' : 'Guardar cambios',
          cargando: _guardando, onPressed: _guardar),
      if (!_esNuevo && !eliminado && !_esPropio)
        Boton('Eliminar usuario', variante: VarianteBoton.danger, onPressed: _eliminar),
    ]);
  }
}
