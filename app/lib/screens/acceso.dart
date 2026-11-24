/// Pantallas sin sesión: bienvenida, inicio de sesión, registro y recuperación de contraseña.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../state/auth.dart';
import '../theme.dart';
import '../util/validacion.dart';
import '../widgets/aviso_privacidad.dart';
import '../widgets/avisos.dart';
import '../widgets/comunes.dart';
import '../widgets/ui.dart';

class Bienvenida extends StatelessWidget {
  const Bienvenida({super.key});

  static const _puntos = [
    (Icons.mark_email_unread_outlined, 'Practica con correos, SMS y sitios simulados'),
    (Icons.verified_user_outlined, 'Aprende a reconocer señales de alerta'),
    (Icons.bar_chart_outlined, 'Mide tu progreso y tu nivel de vulnerabilidad'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.surface,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, c) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: c.maxHeight),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 460),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 24, bottom: 24),
                          child: Col(gap: 20, cross: CrossAxisAlignment.center, children: [
                            const Logo(ancho: 230),
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 340),
                              child: Text(
                                'Aprende a identificar riesgos digitales antes de que sea demasiado tarde.',
                                style: inter(size: 17, height: 25, weight: FontWeight.w500, color: C.textMuted),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ]),
                        ),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.lg)),
                          child: Col(gap: 12, children: [
                            for (final (icono, texto) in _puntos)
                              Row(children: [
                                IconoCaja(icono, tamano: 38),
                                const SizedBox(width: 12),
                                Expanded(child: Text(texto, style: T.body)),
                              ]),
                          ]),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 24),
                          child: Col(gap: 12, children: [
                            Boton('Iniciar sesión', tamano: TamanoBoton.lg, onPressed: () => context.push('/login')),
                            Boton('Crear cuenta',
                                tamano: TamanoBoton.lg,
                                variante: VarianteBoton.outline,
                                onPressed: () => context.push('/registro')),
                            Text('Simulaciones educativas controladas · ESCOM-IPN', style: T.caption, textAlign: TextAlign.center),
                          ]),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Estructura común de login, registro y recuperación: logo, título y tarjeta de formulario.
class _AuthLayout extends StatelessWidget {
  const _AuthLayout({required this.titulo, this.subtitulo, required this.children, this.pie});
  final String titulo;
  final String? subtitulo;
  final List<Widget> children;
  final Widget? pie;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Col(gap: 20, children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: context.canPop()
                        ? BotonIcono(icono: Icons.arrow_back, etiqueta: 'Volver', color: C.navy, onPressed: () => context.pop())
                        : const SizedBox(height: 36),
                  ),
                  const Center(child: Logo(ancho: 150)),
                  Col(gap: 4, cross: CrossAxisAlignment.center, children: [
                    Semantics(header: true, child: Text(titulo, style: T.h1, textAlign: TextAlign.center)),
                    if (subtitulo != null)
                      Text(subtitulo!, style: T.body.copyWith(color: C.textMuted), textAlign: TextAlign.center),
                  ]),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: C.surface,
                      borderRadius: BorderRadius.circular(R.xl),
                      border: Border.all(color: C.border),
                      boxShadow: Sombra.md,
                    ),
                    child: AutofillGroup(child: Col(gap: 16, children: children)),
                  ),
                  if (pie != null) pie!,
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Texto con un enlace al final: «¿No tienes una cuenta? Crea una».
class _PieEnlace extends StatelessWidget {
  const _PieEnlace(this.texto, this.enlace, this.onTap);
  final String texto;
  final String enlace;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Wrap(alignment: WrapAlignment.center, children: [
        Text('$texto ', style: T.body.copyWith(color: C.textMuted)),
        InkWell(
          onTap: onTap,
          child: Text(enlace, style: inter(weight: FontWeight.w600, color: C.primary)),
        ),
      ]);
}

class _Enlace extends StatelessWidget {
  const _Enlace(this.texto, this.onTap);
  final String texto;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        link: true,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text(texto, style: inter(size: 14, weight: FontWeight.w600, color: C.primary)),
          ),
        ),
      );
}

/* ------------------------------------------------------------------ Login */

class Login extends StatefulWidget {
  const Login({super.key});

  @override
  State<Login> createState() => _LoginState();
}

class _LoginState extends State<Login> {
  String _correo = '';
  String _password = '';
  Map<String, String> _errores = {};
  String? _error;
  bool _enviando = false;
  final _passFoco = FocusNode();

  @override
  void dispose() {
    _passFoco.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    final locales = <String, String>{
      if (_correo.trim().isEmpty) 'correo': 'Escribe tu correo electrónico',
      if (_password.isEmpty) 'password': 'Escribe tu contraseña',
    };
    setState(() {
      _error = null;
      _errores = locales;
    });
    if (locales.isNotEmpty) return;
    setState(() => _enviando = true);
    try {
      await context.read<Auth>().iniciarSesion(_correo.trim(), _password);
    } on ApiError catch (e) {
      if (mounted) {
        setState(() {
          _errores = e.camposConError;
          _error = e.message;
        });
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AuthLayout(
      titulo: 'Inicia sesión',
      subtitulo: 'Continúa tu entrenamiento en seguridad digital.',
      pie: _PieEnlace('¿No tienes una cuenta?', 'Crea una', () => context.pushReplacement('/registro')),
      children: [
        ErrorFormulario(_error),
        Campo(
          etiqueta: 'Correo electrónico',
          icono: Icons.mail_outline,
          valor: _correo,
          onChanged: (v) => _correo = v,
          error: _errores['correo'],
          teclado: TextInputType.emailAddress,
          mayusculas: TextCapitalization.none,
          autofill: const [AutofillHints.email],
          accion: TextInputAction.next,
          onSubmitted: (_) => _passFoco.requestFocus(),
          placeholder: 'tucorreo@ejemplo.com',
        ),
        Campo(
          etiqueta: 'Contraseña',
          icono: Icons.lock_outline,
          valor: _password,
          onChanged: (v) => _password = v,
          error: _errores['password'],
          secreto: true,
          focusNode: _passFoco,
          autofill: const [AutofillHints.password],
          accion: TextInputAction.go,
          onSubmitted: (_) => _enviar(),
          placeholder: 'Tu contraseña',
        ),
        Align(
          alignment: Alignment.centerRight,
          child: _Enlace('¿Olvidaste tu contraseña?', () {
            final c = _correo.trim();
            context.push(c.isEmpty ? '/recuperar' : Uri(path: '/recuperar', queryParameters: {'correo': c}).toString());
          }),
        ),
        Boton('Iniciar sesión', tamano: TamanoBoton.lg, cargando: _enviando, onPressed: _enviar),
      ],
    );
  }
}

/* --------------------------------------------------------------- Registro */

class Registro extends StatefulWidget {
  const Registro({super.key});

  @override
  State<Registro> createState() => _RegistroState();
}

class _RegistroState extends State<Registro> {
  final _form = {'nombre': '', 'correo': '', 'password': '', 'confirmar_password': ''};
  bool _aceptaAviso = false;
  bool _mayorDeEdad = false;
  Map<String, String> _errores = {};
  String? _error;
  bool _enviando = false;

  void _set(String campo, String valor) => setState(() {
        _form[campo] = valor;
        _errores.remove(campo);
      });

  Map<String, String> _validar() {
    final f = _form;
    return {
      if (f['nombre']!.trim().length < 2) 'nombre': 'Escribe tu nombre (mínimo 2 caracteres)',
      if (!correoValido(f['correo']!)) 'correo': 'Escribe un correo válido, por ejemplo nombre@dominio.com',
      if (!passwordValida(f['password']!)) 'password': 'La contraseña no cumple los requisitos',
      if (f['confirmar_password']!.isEmpty)
        'confirmar_password': 'Confirma tu contraseña'
      else if (f['confirmar_password'] != f['password'])
        'confirmar_password': 'Las contraseñas no coinciden',
      if (!_aceptaAviso) 'acepta_aviso_privacidad': 'Debes aceptar el aviso de privacidad',
      if (!_mayorDeEdad) 'mayor_de_edad': 'Debes declarar que eres mayor de 18 años',
    };
  }

  Future<void> _enviar() async {
    final locales = _validar();
    setState(() {
      _error = null;
      _errores = locales;
    });
    if (locales.isNotEmpty) return;
    setState(() => _enviando = true);
    try {
      await context.read<Auth>().registrarse({
        ..._form,
        'nombre': _form['nombre']!.trim(),
        'correo': _form['correo']!.trim(),
        'acepta_aviso_privacidad': _aceptaAviso,
        'mayor_de_edad': _mayorDeEdad,
      });
    } on ApiError catch (e) {
      if (mounted) {
        setState(() {
          _errores = e.camposConError;
          _error = e.message;
        });
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final f = _form;
    return _AuthLayout(
      titulo: 'Crea tu cuenta',
      subtitulo: 'Aprende a reconocer engaños por correo electrónico y por SMS.',
      pie: _PieEnlace('¿Ya tienes una cuenta?', 'Inicia sesión', () => context.pushReplacement('/login')),
      children: [
        ErrorFormulario(_error),
        Campo(
          etiqueta: 'Nombre',
          icono: Icons.person_outline,
          valor: f['nombre']!,
          onChanged: (v) => _set('nombre', v),
          error: _errores['nombre'],
          autofill: const [AutofillHints.name],
          placeholder: 'Tu nombre',
          valido: f['nombre']!.trim().length >= 2,
        ),
        Campo(
          etiqueta: 'Correo electrónico',
          icono: Icons.mail_outline,
          valor: f['correo']!,
          onChanged: (v) => _set('correo', v),
          error: _errores['correo'],
          teclado: TextInputType.emailAddress,
          mayusculas: TextCapitalization.none,
          autofill: const [AutofillHints.email],
          placeholder: 'tucorreo@ejemplo.com',
          valido: correoValido(f['correo']!),
        ),
        Campo(
          etiqueta: 'Contraseña',
          icono: Icons.lock_outline,
          valor: f['password']!,
          onChanged: (v) => _set('password', v),
          error: _errores['password'],
          secreto: true,
          autofill: const [AutofillHints.newPassword],
          placeholder: 'Crea una contraseña',
        ),
        ReglasPassword(f['password']!),
        Campo(
          etiqueta: 'Confirmar contraseña',
          icono: Icons.lock_outline,
          valor: f['confirmar_password']!,
          onChanged: (v) => _set('confirmar_password', v),
          error: _errores['confirmar_password'],
          secreto: true,
          autofill: const [AutofillHints.newPassword],
          placeholder: 'Repite tu contraseña',
          valido: f['confirmar_password']!.isNotEmpty && f['confirmar_password'] == f['password'],
          onSubmitted: (_) => _enviar(),
        ),
        CasillasAviso(
          aceptaAviso: _aceptaAviso,
          mayorDeEdad: _mayorDeEdad,
          errorAviso: _errores['acepta_aviso_privacidad'],
          errorMayor: _errores['mayor_de_edad'],
          onAviso: (v) => setState(() {
            _aceptaAviso = v;
            _errores.remove('acepta_aviso_privacidad');
          }),
          onMayor: (v) => setState(() {
            _mayorDeEdad = v;
            _errores.remove('mayor_de_edad');
          }),
        ),
        Boton('Crear cuenta', tamano: TamanoBoton.lg, cargando: _enviando, onPressed: _enviar),
      ],
    );
  }
}

/* ------------------------------------------------------------- Recuperar */

const _esperaReenvio = 60;

/// Recuperar contraseña: 1) pedir código por correo, 2) código + contraseña nueva.
class Recuperar extends StatefulWidget {
  const Recuperar({super.key, this.correo});
  final String? correo;

  @override
  State<Recuperar> createState() => _RecuperarState();
}

class _RecuperarState extends State<Recuperar> {
  bool _pasoCodigo = false;
  late String _correo = widget.correo ?? '';
  final _form = {'codigo': '', 'password': '', 'confirmar_password': ''};
  Map<String, String> _errores = {};
  String? _error;
  bool _enviando = false;
  int _espera = 0;
  Timer? _temporizador;
  final _codigoFoco = FocusNode();

  @override
  void dispose() {
    _temporizador?.cancel();
    _codigoFoco.dispose();
    super.dispose();
  }

  /// Cuenta regresiva para permitir reenviar el código.
  void _iniciarEspera() {
    _temporizador?.cancel();
    setState(() => _espera = _esperaReenvio);
    _temporizador = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _espera--);
      if (_espera <= 0) t.cancel();
    });
  }

  Future<void> _pedirCodigo() async {
    setState(() => _error = null);
    if (!correoValido(_correo)) {
      setState(() => _errores = {'correo': 'Escribe un correo válido, por ejemplo nombre@dominio.com'});
      return;
    }
    setState(() {
      _errores = {};
      _enviando = true;
    });
    try {
      await Api.post('/auth/forgot-password', {'correo': _correo.trim()});
      setState(() => _pasoCodigo = true);
      _iniciarEspera();
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _codigoFoco.requestFocus();
      });
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _reenviar() async {
    try {
      await Api.post('/auth/forgot-password', {'correo': _correo.trim()});
      _iniciarEspera();
      setState(() => _form['codigo'] = '');
      avisoInfo('Si el correo está registrado, te enviamos un código nuevo');
    } on ApiError catch (e) {
      avisoError(e.message);
    }
  }

  Future<void> _cambiar() async {
    final f = _form;
    final locales = <String, String>{
      if (!RegExp(r'^\d{6}$').hasMatch(f['codigo']!.trim())) 'codigo': 'El código tiene 6 dígitos',
      if (!passwordValida(f['password']!)) 'password': 'La contraseña no cumple los requisitos',
      if (f['confirmar_password'] != f['password']) 'confirmar_password': 'Las contraseñas no coinciden',
    };
    setState(() {
      _error = null;
      _errores = locales;
    });
    if (locales.isNotEmpty) return;
    setState(() => _enviando = true);
    try {
      await context.read<Auth>().restablecerPassword({
        'correo': _correo.trim(),
        'codigo': f['codigo']!.trim(),
        'password': f['password'],
        'confirmar_password': f['confirmar_password'],
      });
      avisoExito('Contraseña actualizada. ¡Bienvenido de nuevo!');
    } on ApiError catch (e) {
      if (mounted) {
        setState(() {
          _errores = e.camposConError;
          _error = e.message;
        });
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  void _set(String campo, String v) => setState(() {
        _form[campo] = v;
        _errores.remove(campo);
      });

  @override
  Widget build(BuildContext context) {
    if (!_pasoCodigo) {
      return _AuthLayout(
        titulo: 'Recupera tu contraseña',
        subtitulo: 'Escribe el correo de tu cuenta y te enviaremos un código de 6 dígitos.',
        children: [
          ErrorFormulario(_error),
          Campo(
            etiqueta: 'Correo electrónico',
            icono: Icons.mail_outline,
            valor: _correo,
            onChanged: (v) => _correo = v,
            error: _errores['correo'],
            teclado: TextInputType.emailAddress,
            mayusculas: TextCapitalization.none,
            autofill: const [AutofillHints.email],
            placeholder: 'tucorreo@ejemplo.com',
            accion: TextInputAction.send,
            onSubmitted: (_) => _pedirCodigo(),
          ),
          Boton('Enviar código',
              tamano: TamanoBoton.lg, icono: Icons.send_outlined, cargando: _enviando, onPressed: _pedirCodigo),
          const Aviso(mensaje: 'CyberSense nunca te pedirá tu contraseña ni este código por correo, mensaje o llamada.'),
        ],
      );
    }

    final f = _form;
    return _AuthLayout(
      titulo: 'Crea una contraseña nueva',
      subtitulo: 'Si ${_correo.trim()} está registrado, recibirás un código. Revisa también tu carpeta de spam.',
      children: [
        ErrorFormulario(_error),
        Campo(
          etiqueta: 'Código de 6 dígitos',
          icono: Icons.dialpad,
          valor: f['codigo']!,
          onChanged: (v) => _set('codigo', v.replaceAll(RegExp(r'\D'), '')),
          error: _errores['codigo'],
          focusNode: _codigoFoco,
          teclado: TextInputType.number,
          autofill: const [AutofillHints.oneTimeCode],
          maxLength: 6,
          placeholder: '000000',
          estiloTexto: inter(size: 22, weight: FontWeight.w700, letterSpacing: 6),
        ),
        Campo(
          etiqueta: 'Nueva contraseña',
          icono: Icons.lock_outline,
          valor: f['password']!,
          onChanged: (v) => _set('password', v),
          error: _errores['password'],
          secreto: true,
          autofill: const [AutofillHints.newPassword],
          placeholder: 'Crea una contraseña',
        ),
        ReglasPassword(f['password']!),
        Campo(
          etiqueta: 'Confirmar contraseña',
          icono: Icons.lock_outline,
          valor: f['confirmar_password']!,
          onChanged: (v) => _set('confirmar_password', v),
          error: _errores['confirmar_password'],
          secreto: true,
          autofill: const [AutofillHints.newPassword],
          placeholder: 'Repite tu contraseña',
          valido: f['confirmar_password']!.isNotEmpty && f['confirmar_password'] == f['password'],
          onSubmitted: (_) => _cambiar(),
        ),
        Boton('Cambiar contraseña', tamano: TamanoBoton.lg, cargando: _enviando, onPressed: _cambiar),
        Wrap(alignment: WrapAlignment.spaceBetween, spacing: 8, runSpacing: 8, children: [
          _espera > 0
              ? Text('Puedes pedir otro código en $_espera s', style: T.small)
              : _Enlace('Reenviar código', _reenviar),
          _Enlace('Usar otro correo', () => setState(() {
                _pasoCodigo = false;
                _error = null;
                _errores = {};
              })),
        ]),
      ],
    );
  }
}


/* ---------------------------------------------------------- Aceptar aviso */

/// Cuentas creadas por un administrador: en el primer inicio de sesión el
/// titular acepta el aviso de privacidad antes de usar la app (RN-23).
class AceptarAviso extends StatefulWidget {
  const AceptarAviso({super.key});

  @override
  State<AceptarAviso> createState() => _AceptarAvisoState();
}

class _AceptarAvisoState extends State<AceptarAviso> {
  bool _aceptaAviso = false;
  bool _mayorDeEdad = false;
  bool _intentado = false;
  String? _error;
  bool _enviando = false;

  Future<void> _aceptar() async {
    setState(() {
      _intentado = true;
      _error = null;
    });
    if (!_aceptaAviso || !_mayorDeEdad) return;
    setState(() => _enviando = true);
    try {
      await context.read<Auth>().aceptarAviso();
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AuthLayout(
      titulo: 'Antes de comenzar',
      subtitulo: 'Un administrador creó tu cuenta. Para usar CyberSense revisa y acepta el aviso de privacidad.',
      pie: _PieEnlace('¿No es tu cuenta?', 'Cerrar sesión', () => context.read<Auth>().cerrarSesion()),
      children: [
        ErrorFormulario(_error),
        CasillasAviso(
          aceptaAviso: _aceptaAviso,
          mayorDeEdad: _mayorDeEdad,
          errorAviso: _intentado && !_aceptaAviso ? 'Debes aceptar el aviso de privacidad' : null,
          errorMayor: _intentado && !_mayorDeEdad ? 'Debes declarar que eres mayor de 18 años' : null,
          onAviso: (v) => setState(() => _aceptaAviso = v),
          onMayor: (v) => setState(() => _mayorDeEdad = v),
        ),
        Boton('Continuar', tamano: TamanoBoton.lg, cargando: _enviando, onPressed: _aceptar),
      ],
    );
  }
}
