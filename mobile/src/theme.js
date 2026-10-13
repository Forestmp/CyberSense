/**
 * Identidad visual CyberSense.
 * Azules como base; verde, ámbar y rojo solo para estados. Los colores de
 * texto sobre fondos suaves usan tonos más oscuros para cumplir contraste AA.
 */
export const colors = {
  navy: '#0B1F4D',
  primary: '#2563EB',
  bright: '#2F80FF',
  primarySoft: '#EAF2FF',
  cyan: '#22D3EE',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',

  success: '#16A34A',
  successText: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#F59E0B',
  warningText: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerText: '#B91C1C',
  dangerSoft: '#FEE2E2',
  neutralSoft: '#F1F5F9',

  // Alias usados por pantallas existentes
  primaryDark: '#0B1F4D',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

/** Estilos tipográficos base. */
export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, color: colors.navy, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: colors.navy, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, color: colors.navy },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = (n) => n * 4;

/** Sombras ligeras (boxShadow funciona en Android, iOS y web con la nueva arquitectura). */
export const shadow = {
  sm: { boxShadow: '0px 1px 3px rgba(11, 31, 77, 0.06)' },
  md: { boxShadow: '0px 6px 18px rgba(11, 31, 77, 0.07)' },
  lg: { boxShadow: '0px 12px 32px rgba(11, 31, 77, 0.12)' },
};

/** Ancho a partir del cual se usa disposición de tablet/escritorio. */
export const BREAKPOINT_ANCHO = 768;
