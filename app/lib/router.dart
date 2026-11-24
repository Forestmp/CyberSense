import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'screens/acceso.dart';
import 'screens/admin/escenario_detalle.dart';
import 'screens/admin/escenario_editor.dart';
import 'screens/admin/escenarios.dart';
import 'screens/admin/usuario_form.dart';
import 'screens/admin/usuarios.dart';
import 'screens/aprender.dart';
import 'screens/diagnostico.dart';
import 'screens/historial.dart';
import 'screens/inicio.dart';
import 'screens/perfil.dart';
import 'screens/progreso.dart';
import 'screens/resultado.dart';
import 'screens/retroalimentacion.dart';
import 'screens/simulacion.dart';
import 'screens/simulaciones.dart';
import 'state/auth.dart';
import 'theme.dart';
import 'widgets/ui.dart';

const _rutasPublicas = {'/bienvenida', '/login', '/registro', '/recuperar'};

/// Pestañas de la barra inferior: (ruta, título, encabezado, ícono activo, ícono inactivo).
const _pestanas = [
  ('/', 'Inicio', null, Icons.home, Icons.home_outlined),
  ('/simulaciones', 'Simular', 'Simulaciones', Icons.verified_user, Icons.verified_user_outlined),
  ('/progreso', 'Progreso', 'Mi progreso', Icons.bar_chart, Icons.bar_chart_outlined),
  ('/historial', 'Historial', 'Historial', Icons.history, Icons.history_outlined),
  ('/perfil', 'Perfil', 'Mi perfil', Icons.account_circle, Icons.account_circle_outlined),
];

final _raiz = GlobalKey<NavigatorState>();

GoRouter crearRouter(Auth auth) {
  int id(GoRouterState s) => int.tryParse(s.pathParameters['id'] ?? '') ?? 0;

  /// Pantalla apilada con barra superior y botón de regreso.
  GoRoute apilada(String path, String titulo, Widget Function(GoRouterState s) pantalla) => GoRoute(
        path: path,
        parentNavigatorKey: _raiz,
        builder: (_, s) => Scaffold(appBar: AppBar(title: Text(titulo)), body: SafeArea(top: false, child: pantalla(s))),
      );

  return GoRouter(
    navigatorKey: _raiz,
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (context, state) {
      final ruta = state.matchedLocation;
      if (auth.cargando) return ruta == '/cargando' ? null : '/cargando';
      final publica = _rutasPublicas.contains(ruta);
      if (auth.usuario == null) return publica ? null : '/bienvenida';
      // RN-23: sin aceptar el aviso de privacidad solo se muestra la pantalla para aceptarlo.
      if (auth.avisoPendiente) return ruta == '/aviso' ? null : '/aviso';
      if (publica || ruta == '/cargando' || ruta == '/aviso') return '/';
      if (ruta.startsWith('/admin') && !auth.esAdmin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/cargando', builder: (_, __) => const Scaffold(body: Cargando())),
      GoRoute(path: '/bienvenida', builder: (_, __) => const Bienvenida()),
      GoRoute(path: '/login', builder: (_, __) => const Login()),
      GoRoute(path: '/registro', builder: (_, __) => const Registro()),
      GoRoute(path: '/recuperar', builder: (_, s) => Recuperar(correo: s.uri.queryParameters['correo'])),
      GoRoute(path: '/aviso', builder: (_, __) => const AceptarAviso()),

      ShellRoute(
        builder: (context, state, child) => _ConPestanas(ruta: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const Inicio()),
          GoRoute(path: '/simulaciones', builder: (_, __) => const Simulaciones()),
          GoRoute(path: '/progreso', builder: (_, __) => const Progreso()),
          GoRoute(path: '/historial', builder: (_, __) => const Historial()),
          GoRoute(path: '/perfil', builder: (_, __) => const Perfil()),
        ],
      ),

      GoRoute(path: '/simulacion/:id', parentNavigatorKey: _raiz, builder: (_, s) => Simulacion(escenarioId: id(s))),
      GoRoute(path: '/diagnostico', parentNavigatorKey: _raiz, builder: (_, __) => const Diagnostico()),
      apilada('/resultado/:id', 'Resultado', (s) => Resultado(intentoId: id(s))),
      apilada('/retroalimentacion/:id', 'Retroalimentación', (s) => Retroalimentacion(intentoId: id(s))),
      apilada('/aprender', 'Aprender', (_) => const Aprender()),

      apilada('/admin/escenarios', 'Administrar escenarios', (_) => const AdminEscenarios()),
      GoRoute(path: '/admin/escenarios/nuevo', parentNavigatorKey: _raiz, builder: (_, __) => const EditorEscenario()),
      GoRoute(path: '/admin/escenarios/:id', parentNavigatorKey: _raiz, builder: (_, s) => VerEscenario(escenarioId: id(s))),
      GoRoute(
          path: '/admin/escenarios/:id/editar',
          parentNavigatorKey: _raiz,
          builder: (_, s) => EditorEscenario(escenarioId: id(s))),
      apilada('/admin/usuarios', 'Administrar usuarios', (_) => const AdminUsuarios()),
      GoRoute(
          path: '/admin/usuarios/:id',
          parentNavigatorKey: _raiz,
          builder: (_, s) => FormularioUsuario(usuarioId: s.pathParameters['id'] == 'nuevo' ? null : id(s))),
    ],
  );
}

/// Barra de navegación inferior con las cinco pestañas principales.
class _ConPestanas extends StatelessWidget {
  const _ConPestanas({required this.ruta, required this.child});
  final String ruta;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final encontrado = _pestanas.indexWhere((p) => p.$1 == ruta);
    final indice = encontrado < 0 ? 0 : encontrado;
    final encabezado = _pestanas[indice].$3;
    return Scaffold(
      appBar: encabezado == null ? null : AppBar(title: Text(encabezado)),
      body: SafeArea(top: encabezado == null, bottom: false, child: child),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: C.surface,
          indicatorColor: C.primarySoft,
          surfaceTintColor: Colors.transparent,
          labelTextStyle: WidgetStateProperty.resolveWith((s) => inter(
                size: 11,
                weight: s.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
                color: s.contains(WidgetState.selected) ? C.primary : C.textMuted,
              )),
        ),
        child: Container(
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.border))),
          child: NavigationBar(
            selectedIndex: indice,
            height: 68,
            onDestinationSelected: (i) => context.go(_pestanas[i].$1),
            destinations: [
              for (final p in _pestanas)
                NavigationDestination(
                  icon: Icon(p.$5, color: C.textMuted),
                  selectedIcon: Icon(p.$4, color: C.primary),
                  label: p.$2,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
