/// Reglas de contraseña: las mismas que valida la API.
library;

class ReglaPassword {
  const ReglaPassword(this.ok, this.texto);
  final bool ok;
  final String texto;
}

List<ReglaPassword> reglasPassword(String p) => [
      ReglaPassword(p.length >= 8, 'Al menos 8 caracteres'),
      ReglaPassword(RegExp(r'[A-Za-zÁÉÍÓÚÑáéíóúñ]').hasMatch(p), 'Al menos una letra'),
      ReglaPassword(RegExp(r'\d').hasMatch(p), 'Al menos un número'),
    ];

bool passwordValida(String p) => reglasPassword(p).every((r) => r.ok);

bool correoValido(String c) => RegExp(r'^\S+@\S+\.\S+$').hasMatch(c.trim());
