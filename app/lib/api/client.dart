import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

typedef Json = Map<String, dynamic>;

/// URL de la API. Prioridad:
///  1. --dart-define=API_URL=https://... al compilar.
///  2. En web, el mismo host desde el que se abrió la página, puerto 8000.
///  3. En el emulador de Android, la computadora anfitriona (10.0.2.2:8000).
String _resolverApiUrl() {
  const definida = String.fromEnvironment('API_URL');
  if (definida.isNotEmpty) return definida.replaceAll(RegExp(r'/$'), '');
  if (kIsWeb) return 'http://${Uri.base.host}:8000';
  return 'http://10.0.2.2:8000';
}

final apiUrl = _resolverApiUrl();

class ApiError implements Exception {
  ApiError(this.status, this.message, {this.code, this.details});

  final int status;
  final String message;
  final String? code;
  final dynamic details;

  /// Convierte details [{campo: 'body.correo', mensaje}] en {correo: mensaje}.
  Map<String, String> get camposConError {
    final out = <String, String>{};
    if (details is! List) return out;
    for (final d in details as List) {
      if (d is! Map) continue;
      final partes = '${d['campo'] ?? ''}'.split('.');
      final campo = partes.length > 1 ? partes.sublist(1).join('.') : partes.first;
      if (campo.isNotEmpty) out.putIfAbsent(campo, () => '${d['mensaje']}');
    }
    return out;
  }

  @override
  String toString() => message;
}

/// Cliente HTTP de la API: agrega el token, serializa JSON y traduce errores.
class Api {
  Api._();

  static String? token;

  /// Se llama cuando la API responde 401 con una sesión abierta (token vencido o revocado).
  static VoidCallback? onUnauthorized;

  static Future<dynamic> get(String path, {Map<String, Object?>? query}) => _enviar('GET', path, query: query);
  static Future<dynamic> post(String path, [Object? body]) => _enviar('POST', path, body: body);
  static Future<dynamic> put(String path, Object? body) => _enviar('PUT', path, body: body);
  static Future<dynamic> patch(String path, Object? body) => _enviar('PATCH', path, body: body);
  static Future<dynamic> delete(String path) => _enviar('DELETE', path);

  static Future<dynamic> _enviar(String metodo, String path, {Object? body, Map<String, Object?>? query}) async {
    final parametros = <String, String>{
      for (final e in (query ?? {}).entries)
        if (e.value != null && '${e.value}' != '') e.key: '${e.value}',
    };
    final uri = Uri.parse('$apiUrl/api$path').replace(queryParameters: parametros.isEmpty ? null : parametros);
    final request = http.Request(metodo, uri)
      ..headers['Accept'] = 'application/json';
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }

    http.Response res;
    try {
      res = await http.Response.fromStream(await request.send().timeout(const Duration(seconds: 60)));
    } catch (_) {
      throw ApiError(0, 'No se pudo conectar con el servidor ($apiUrl). Verifica tu conexión e intenta de nuevo.',
          code: 'NETWORK');
    }

    if (res.statusCode == 204) return null;
    dynamic data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 400) {
      final e = data is Map && data['error'] is Map ? data['error'] as Map : const {};
      if (res.statusCode == 401 && token != null) onUnauthorized?.call();
      throw ApiError(res.statusCode, '${e['message'] ?? 'Error ${res.statusCode}'}',
          code: e['code'] as String?, details: e['details']);
    }
    return data;
  }
}
