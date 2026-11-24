import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme.dart';

class InfoNivel {
  const InfoNivel(this.label, this.icon, this.bg, this.fg, this.bar);
  final String label;
  final IconData icon;
  final Color bg;
  final Color fg;
  final Color bar;
}

/// Niveles de vulnerabilidad: color + ícono + texto (nunca solo color).
const niveles = {
  'bajo': InfoNivel('Baja', Icons.verified_user, C.successSoft, C.successText, C.success),
  'medio': InfoNivel('Media', Icons.error, C.warningSoft, C.warningText, C.warning),
  'alto': InfoNivel('Alta', Icons.warning_rounded, Color(0xFFFFEDD5), Color(0xFFC2410C), Color(0xFFEA580C)),
  'critico': InfoNivel('Crítica', Icons.cancel, C.dangerSoft, C.dangerText, C.danger),
};

InfoNivel nivelInfo(Object? nivel) =>
    niveles[nivel] ?? const InfoNivel('Sin datos', Icons.help_outline, C.neutralSoft, C.textMuted, C.border);

/// Nivel que correspondería a un puntaje con los rangos provisionales (para colorear gráficas).
String nivelDePuntaje(num p) => p >= 80 ? 'bajo' : p >= 60 ? 'medio' : p >= 40 ? 'alto' : 'critico';

class InfoTipo {
  const InfoTipo(this.icon, this.label);
  final IconData icon;
  final String label;
}

const tiposAtaque = {
  'phishing': InfoTipo(Icons.mail_outline, 'Phishing'),
  'smishing': InfoTipo(Icons.sms_outlined, 'Smishing'),
};

InfoTipo tipoInfo(Object? tipo) => tiposAtaque[tipo] ?? InfoTipo(Icons.shield_outlined, '$tipo');

const dificultades = {'basico': 1, 'intermedio': 2, 'avanzado': 3};

class InfoEtiqueta {
  const InfoEtiqueta(this.label, this.bg, this.fg, [this.icon]);
  final String label;
  final Color bg;
  final Color fg;
  final IconData? icon;
}

const tiposAccion = {
  'segura': InfoEtiqueta('Segura', C.successSoft, C.successText),
  'neutral': InfoEtiqueta('Neutral', C.neutralSoft, C.textMuted),
  'mejorable': InfoEtiqueta('Mejorable', C.warningSoft, C.warningText),
  'riesgosa': InfoEtiqueta('Riesgosa', C.warningSoft, C.warningText),
  'critica': InfoEtiqueta('Crítica', C.dangerSoft, C.dangerText),
};

const valoraciones = {
  'correcta': InfoEtiqueta('Decisión segura', C.successSoft, C.successText, Icons.check_circle),
  'neutral': InfoEtiqueta('Decisión neutral', C.neutralSoft, C.textMuted, Icons.radio_button_unchecked),
  'mejorable': InfoEtiqueta('Decisión mejorable', C.warningSoft, C.warningText, Icons.remove_circle),
  'incorrecta': InfoEtiqueta('Decisión riesgosa', C.dangerSoft, C.dangerText, Icons.cancel),
};

const estadosEscenario = {
  'activo': InfoEtiqueta('Activo', C.successSoft, C.successText, Icons.check_circle),
  'borrador': InfoEtiqueta('Borrador', C.primarySoft, C.primary, Icons.edit_outlined),
  'inactivo': InfoEtiqueta('Inactivo', C.warningSoft, C.warningText, Icons.pause_circle),
  'eliminado': InfoEtiqueta('Eliminado', C.neutralSoft, C.textMuted, Icons.delete_outline),
};
DateTime? _fecha(Object? iso) => iso == null ? null : DateTime.tryParse('$iso')?.toLocal();

String fecha(Object? iso) {
  final d = _fecha(iso);
  return d == null ? '—' : DateFormat('dd MMM yyyy', 'es_MX').format(d);
}

String fechaHora(Object? iso) {
  final d = _fecha(iso);
  return d == null ? '—' : DateFormat('dd MMM yyyy, HH:mm', 'es_MX').format(d);
}

/// Puntaje sin decimales si es entero; con uno si no.
String puntos(Object? n) {
  if (n is! num) return '—';
  return n == n.roundToDouble() ? '${n.round()}' : n.toStringAsFixed(1);
}

String duracion(Object? ms) {
  if (ms is! num) return '—';
  final s = (ms / 1000).round();
  return s < 60 ? '$s s' : '${s ~/ 60} min ${s % 60} s';
}

/// Número desde JSON (int o double) como double.
double numero(Object? v) => v is num ? v.toDouble() : 0;
