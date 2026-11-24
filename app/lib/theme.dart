/// Identidad visual CyberSense.
/// Azules como base; verde, ámbar y rojo solo para estados. Los colores de
/// texto sobre fondos suaves usan tonos más oscuros para cumplir contraste AA.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class C {
  static const navy = Color(0xFF0B1F4D);
  static const primary = Color(0xFF2563EB);
  static const bright = Color(0xFF2F80FF);
  static const primarySoft = Color(0xFFEAF2FF);
  static const cyan = Color(0xFF22D3EE);
  static const bg = Color(0xFFF8FAFC);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF0F172A);
  static const textMuted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);

  static const success = Color(0xFF16A34A);
  static const successText = Color(0xFF15803D);
  static const successSoft = Color(0xFFDCFCE7);
  static const warning = Color(0xFFF59E0B);
  static const warningText = Color(0xFFB45309);
  static const warningSoft = Color(0xFFFEF3C7);
  static const danger = Color(0xFFDC2626);
  static const dangerText = Color(0xFFB91C1C);
  static const dangerSoft = Color(0xFFFEE2E2);
  static const neutralSoft = Color(0xFFF1F5F9);
}

/// Estilo con la fuente Inter.
TextStyle inter({double size = 15, FontWeight weight = FontWeight.w400, Color color = C.text, double? height,
    double? letterSpacing, FontStyle? fontStyle}) {
  return GoogleFonts.inter(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height == null ? null : height / size,
    letterSpacing: letterSpacing,
    fontStyle: fontStyle,
  );
}

/// Estilos tipográficos base.
abstract final class T {
  static TextStyle get display => inter(size: 30, height: 36, weight: FontWeight.w800, color: C.navy, letterSpacing: -0.5);
  static TextStyle get h1 => inter(size: 24, height: 30, weight: FontWeight.w700, color: C.navy, letterSpacing: -0.3);
  static TextStyle get h2 => inter(size: 19, height: 25, weight: FontWeight.w700, color: C.navy);
  static TextStyle get h3 => inter(size: 16, height: 22, weight: FontWeight.w600);
  static TextStyle get body => inter(size: 15, height: 22);
  static TextStyle get bodyStrong => inter(size: 15, height: 22, weight: FontWeight.w600);
  static TextStyle get small => inter(size: 13, height: 18, color: C.textMuted);
  static TextStyle get caption => inter(size: 12, height: 16, weight: FontWeight.w500, color: C.textMuted);
  static TextStyle get label => inter(size: 14, height: 20, weight: FontWeight.w600);
  static TextStyle get overline =>
      inter(size: 11, height: 14, weight: FontWeight.w700, color: C.textMuted, letterSpacing: 1);
}

abstract final class R {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 22.0;
  static const pill = 999.0;
}

/// Espaciado en múltiplos de 4.
double sp(double n) => n * 4;

/// Sombras ligeras.
abstract final class Sombra {
  static const sm = [BoxShadow(color: Color(0x0F0B1F4D), offset: Offset(0, 1), blurRadius: 3)];
  static const md = [BoxShadow(color: Color(0x120B1F4D), offset: Offset(0, 6), blurRadius: 18)];
  static const lg = [BoxShadow(color: Color(0x1F0B1F4D), offset: Offset(0, 12), blurRadius: 32)];
}

/// Ancho a partir del cual se usa disposición de tablet/escritorio.
const breakpointAncho = 768.0;

ThemeData temaCyberSense() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: C.primary, primary: C.primary, surface: C.surface),
    scaffoldBackgroundColor: C.bg,
  );
  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(bodyColor: C.text, displayColor: C.navy),
    appBarTheme: AppBarTheme(
      backgroundColor: C.surface,
      surfaceTintColor: Colors.transparent,
      foregroundColor: C.primary,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: inter(size: 18, weight: FontWeight.w700, color: C.navy),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: C.primary),
  );
}
