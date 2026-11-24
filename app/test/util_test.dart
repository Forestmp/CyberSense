import 'package:cybersense/api/client.dart';
import 'package:cybersense/util/etiquetas.dart';
import 'package:cybersense/util/validacion.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('validación', () {
    test('la contraseña exige 8 caracteres, una letra y un número', () {
      expect(passwordValida('Segura123'), isTrue);
      expect(passwordValida('corta1'), isFalse);
      expect(passwordValida('sinnumeros'), isFalse);
      expect(passwordValida('12345678'), isFalse);
      expect(passwordValida('ñandú2024'), isTrue);
    });

    test('correo', () {
      expect(correoValido(' ana@dominio.mx '), isTrue);
      expect(correoValido('ana@dominio'), isFalse);
    });
  });

  group('etiquetas', () {
    test('puntos sin decimales si es entero', () {
      expect(puntos(55), '55');
      expect(puntos(55.0), '55');
      expect(puntos(72.5), '72.5');
      expect(puntos(null), '—');
    });

    test('nivel por puntaje', () {
      expect(nivelDePuntaje(80), 'bajo');
      expect(nivelDePuntaje(60), 'medio');
      expect(nivelDePuntaje(59.9), 'alto');
      expect(nivelDePuntaje(10), 'critico');
    });

    test('nivel desconocido', () {
      expect(nivelInfo(null).label, 'Sin datos');
    });
  });

  test('ApiError traduce los detalles a campos', () {
    final e = ApiError(400, 'Datos de entrada inválidos', details: [
      {'campo': 'body.correo', 'mensaje': 'Correo electrónico inválido'},
      {'campo': 'body.correo', 'mensaje': 'otro'},
      {'campo': 'body.confirmar_password', 'mensaje': 'Las contraseñas no coinciden'},
    ]);
    expect(e.camposConError, {
      'correo': 'Correo electrónico inválido',
      'confirmar_password': 'Las contraseñas no coinciden',
    });
  });
}
