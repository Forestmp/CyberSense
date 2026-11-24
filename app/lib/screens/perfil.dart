import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../state/auth.dart';
import '../theme.dart';
import '../util/etiquetas.dart';
import '../widgets/avisos.dart';
import '../widgets/ui.dart';

class Perfil extends StatelessWidget {
  const Perfil({super.key});

  Future<void> _salir(BuildContext context) async {
    final auth = context.read<Auth>();
    if (await confirmar(context,
        titulo: 'Cerrar sesión',
        mensaje: '¿Quieres salir de CyberSense en este dispositivo?',
        textoConfirmar: 'Cerrar sesión')) {
      await auth.cerrarSesion();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<Auth>();
    final u = auth.usuario!;
    final iniciales = auth.nombre.split(' ').where((p) => p.isNotEmpty).take(2).map((p) => p[0]).join().toUpperCase();

    return Pantalla(children: [
      Tarjeta(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        child: Col(gap: 8, cross: CrossAxisAlignment.center, children: [
          Container(
            width: 76,
            height: 76,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: C.navy, shape: BoxShape.circle),
            child: Text(iniciales, style: inter(size: 26, weight: FontWeight.w700, color: Colors.white)),
          ),
          Text(auth.nombre, style: T.h1, textAlign: TextAlign.center),
          Insignia(auth.esAdmin ? 'Administrador' : 'Usuario',
              tono: auth.esAdmin ? TonoInsignia.info : TonoInsignia.neutral,
              icono: auth.esAdmin ? Icons.key_outlined : Icons.person_outline),
        ]),
      ),
      Tarjeta(
        child: Col(gap: 4, children: [
          _Dato(Icons.person_outline, 'Nombre', auth.nombre),
          _Dato(Icons.mail_outline, 'Correo electrónico', '${u['correo']}'),
          _Dato(Icons.calendar_today_outlined, 'Fecha de registro', fecha(u['fecha_registro'])),
        ]),
      ),
      const TituloSeccion('Cuenta'),
      _Opcion(Icons.edit_outlined, 'Editar perfil', () => showDialog(context: context, builder: (_) => const _EditarPerfil())),
      _Opcion(Icons.lock_outline, 'Cambiar contraseña',
          () => showDialog(context: context, builder: (_) => const _CambiarPassword())),
      _Opcion(Icons.menu_book_outlined, 'Aprender', () => context.push('/aprender')),
      if (auth.esAdmin) ...[
        const TituloSeccion('Administración'),
        _Opcion(Icons.layers_outlined, 'Administrar escenarios', () => context.push('/admin/escenarios')),
        _Opcion(Icons.people_outline, 'Administrar usuarios', () => context.push('/admin/usuarios')),
      ],
      Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Boton('Cerrar sesión', icono: Icons.logout, variante: VarianteBoton.danger, onPressed: () => _salir(context)),
      ),
    ]);
  }
}

class _Dato extends StatelessWidget {
  const _Dato(this.icono, this.etiqueta, this.valor);
  final IconData icono;
  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Icon(icono, size: 18, color: C.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(etiqueta, style: T.caption),
              Text(valor, style: T.bodyStrong),
            ]),
          ),
        ]),
      );
}

class _Opcion extends StatelessWidget {
  const _Opcion(this.icono, this.titulo, this.onTap);
  final IconData icono;
  final String titulo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Tarjeta(
        onTap: onTap,
        semantica: titulo,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(children: [
          Icon(icono, size: 20, color: C.primary),
          const SizedBox(width: 12),
          Expanded(child: Text(titulo, style: T.bodyStrong)),
          const Icon(Icons.chevron_right, size: 18, color: C.textMuted),
        ]),
      );
}

class _EditarPerfil extends StatefulWidget {
  const _EditarPerfil();

  @override
  State<_EditarPerfil> createState() => _EditarPerfilState();
}

class _EditarPerfilState extends State<_EditarPerfil> {
  late final Auth _auth = context.read<Auth>();
  late String _nombre = _auth.nombre;
  late String _correo = '${_auth.usuario!['correo']}';
  Map<String, String> _campos = {};
  String? _error;
  bool _guardando = false;

  Future<void> _guardar() async {
    final u = _auth.usuario!;
    final body = <String, String>{
      if (_nombre.trim() != u['nombre']) 'nombre': _nombre.trim(),
      if (_correo.trim().toLowerCase() != u['correo']) 'correo': _correo.trim(),
    };
    if (body.isEmpty) {
      Navigator.pop(context);
      return;
    }
    setState(() => _guardando = true);
    try {
      final r = await Api.put('/users/${_auth.id}', body);
      _auth.actualizarUsuario(r['usuario'] as Json);
      if (mounted) Navigator.pop(context);
      avisoExito('Perfil actualizado correctamente');
    } on ApiError catch (e) {
      setState(() {
        _campos = e.camposConError;
        _error = e.message;
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) => Dialogo(
        titulo: 'Editar perfil',
        icono: Icons.edit_outlined,
        acciones: [
          Boton('Guardar cambios', cargando: _guardando, onPressed: _guardar),
          Boton('Cancelar', variante: VarianteBoton.ghost, onPressed: () => Navigator.pop(context)),
        ],
        child: Col(gap: 12, children: [
          ErrorFormulario(_error),
          Campo(etiqueta: 'Nombre', icono: Icons.person_outline, valor: _nombre, error: _campos['nombre'],
              onChanged: (v) => _nombre = v),
          Campo(
              etiqueta: 'Correo electrónico',
              icono: Icons.mail_outline,
              valor: _correo,
              error: _campos['correo'],
              teclado: TextInputType.emailAddress,
              mayusculas: TextCapitalization.none,
              onChanged: (v) => _correo = v),
        ]),
      );
}

class _CambiarPassword extends StatefulWidget {
  const _CambiarPassword();

  @override
  State<_CambiarPassword> createState() => _CambiarPasswordState();
}

class _CambiarPasswordState extends State<_CambiarPassword> {
  final _pwd = {'password_actual': '', 'password_nueva': '', 'confirmar': ''};
  Map<String, String> _campos = {};
  String? _error;
  bool _guardando = false;

  Future<void> _cambiar() async {
    if (_pwd['password_nueva'] != _pwd['confirmar']) {
      setState(() {
        _campos = {'confirmar': 'Las contraseñas no coinciden'};
        _error = null;
      });
      return;
    }
    final auth = context.read<Auth>();
    setState(() => _guardando = true);
    try {
      final r = await Api.put('/users/${auth.id}', {
        'password_actual': _pwd['password_actual'],
        'password_nueva': _pwd['password_nueva'],
      });
      if (r['token'] != null) await auth.renovarToken(r['token'] as String);
      if (mounted) Navigator.pop(context);
      avisoExito('Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.');
    } on ApiError catch (e) {
      setState(() {
        _campos = e.camposConError;
        _error = e.message;
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final completo = _pwd.values.every((v) => v.isNotEmpty);
    void set(String k, String v) => setState(() => _pwd[k] = v);
    return Dialogo(
      titulo: 'Cambiar contraseña',
      icono: Icons.lock_outline,
      acciones: [
        Boton('Actualizar contraseña', cargando: _guardando, deshabilitado: !completo, onPressed: _cambiar),
        Boton('Cancelar', variante: VarianteBoton.ghost, onPressed: () => Navigator.pop(context)),
      ],
      child: Col(gap: 12, children: [
        ErrorFormulario(_error),
        Campo(
            etiqueta: 'Contraseña actual',
            secreto: true,
            valor: _pwd['password_actual']!,
            error: _campos['password_actual'],
            autofill: const [AutofillHints.password],
            onChanged: (v) => set('password_actual', v)),
        Campo(
            etiqueta: 'Nueva contraseña',
            secreto: true,
            valor: _pwd['password_nueva']!,
            error: _campos['password_nueva'],
            ayuda: 'Mínimo 8 caracteres, con letras y números',
            autofill: const [AutofillHints.newPassword],
            onChanged: (v) => set('password_nueva', v)),
        Campo(
            etiqueta: 'Confirmar nueva contraseña',
            secreto: true,
            valor: _pwd['confirmar']!,
            error: _campos['confirmar'],
            autofill: const [AutofillHints.newPassword],
            onChanged: (v) => set('confirmar', v)),
      ]),
    );
  }
}
