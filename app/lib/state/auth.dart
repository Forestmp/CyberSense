import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/client.dart';

const _tokenKey = 'tt_token';

/// Sesión del usuario. El token se guarda cifrado en el almacenamiento seguro del sistema.
class Auth extends ChangeNotifier {
  Auth() {
    Api.onUnauthorized = cerrarSesion;
  }

  final _storage = const FlutterSecureStorage();

  Json? usuario;
  bool cargando = true;

  bool get esAdmin => usuario?['rol'] == 'administrador';

  /// Cuentas creadas por un administrador: el titular debe aceptar el aviso de privacidad (RN-23).
  bool get avisoPendiente => usuario != null && usuario!['fecha_aceptacion_aviso'] == null;
  int get id => usuario!['id'] as int;
  String get nombre => '${usuario?['nombre'] ?? ''}';

  /// Restaura la sesión guardada al abrir la app.
  Future<void> restaurar() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      if (token != null) {
        Api.token = token;
        usuario = (await Api.get('/auth/me'))['usuario'] as Json;
      }
    } catch (_) {
      await _limpiar();
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  Future<void> _abrir(dynamic r) async {
    Api.token = r['token'] as String;
    await _storage.write(key: _tokenKey, value: Api.token);
    usuario = r['usuario'] as Json;
    notifyListeners();
  }

  Future<void> _limpiar() async {
    Api.token = null;
    usuario = null;
    await _storage.delete(key: _tokenKey);
  }

  Future<void> iniciarSesion(String correo, String password) async =>
      _abrir(await Api.post('/auth/login', {'correo': correo, 'password': password}));

  Future<void> registrarse(Json datos) async => _abrir(await Api.post('/auth/register', datos));

  /// Restablece la contraseña con el código recibido por correo e inicia sesión.
  Future<void> restablecerPassword(Json datos) async => _abrir(await Api.post('/auth/reset-password', datos));

  /// Tras cambiar la contraseña la API emite un token nuevo (el anterior deja de valer).
  Future<void> renovarToken(String token) async {
    Api.token = token;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<void> aceptarAviso() async {
    final r = await Api.post('/auth/accept-privacy', {'acepta_aviso_privacidad': true, 'mayor_de_edad': true});
    actualizarUsuario(r['usuario'] as Json);
  }

  void actualizarUsuario(Json u) {
    usuario = u;
    notifyListeners();
  }

  Future<void> cerrarSesion() async {
    await _limpiar();
    notifyListeners();
  }
}
