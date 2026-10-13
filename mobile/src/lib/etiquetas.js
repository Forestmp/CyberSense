import { colors } from '../theme';

export const NIVELES = {
  bajo: { label: 'Bajo', bg: colors.successSoft, fg: colors.success },
  medio: { label: 'Medio', bg: colors.warningSoft, fg: colors.warning },
  alto: { label: 'Alto', bg: '#FFEDD5', fg: '#C2410C' },
  critico: { label: 'Crítico', bg: colors.dangerSoft, fg: colors.danger },
};

export const nivelInfo = (nivel) => NIVELES[nivel] || { label: '—', bg: colors.neutralSoft, fg: colors.textMuted };

export const TIPOS_ACCION = {
  segura: { label: 'Segura', bg: colors.successSoft, fg: colors.success },
  neutral: { label: 'Neutral', bg: colors.neutralSoft, fg: colors.textMuted },
  riesgosa: { label: 'Riesgosa', bg: colors.warningSoft, fg: colors.warning },
  critica: { label: 'Crítica', bg: colors.dangerSoft, fg: colors.danger },
};

export const VALORACIONES = {
  correcta: { label: 'Decisión segura', icono: '✓', fg: colors.success, bg: colors.successSoft },
  mejorable: { label: 'Decisión mejorable', icono: '•', fg: colors.warning, bg: colors.warningSoft },
  incorrecta: { label: 'Decisión riesgosa', icono: '✕', fg: colors.danger, bg: colors.dangerSoft },
};

export const ESTADOS_ESCENARIO = {
  activo: { label: 'Activo', bg: colors.successSoft, fg: colors.success },
  borrador: { label: 'Borrador', bg: colors.primarySoft, fg: colors.primaryDark },
  inactivo: { label: 'Inactivo', bg: colors.warningSoft, fg: colors.warning },
  eliminado: { label: 'Eliminado', bg: colors.neutralSoft, fg: colors.textMuted },
};

export const fecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const puntos = (n) => (n == null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1));

export const duracion = (ms) => {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};
