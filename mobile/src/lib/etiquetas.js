import { colors } from '../theme';

/** Niveles de vulnerabilidad: color + ícono + texto (nunca solo color). */
export const NIVELES = {
  bajo: { label: 'Baja', icon: 'shield-checkmark', bg: colors.successSoft, fg: colors.successText, bar: colors.success },
  medio: { label: 'Media', icon: 'alert-circle', bg: colors.warningSoft, fg: colors.warningText, bar: colors.warning },
  alto: { label: 'Alta', icon: 'warning', bg: '#FFEDD5', fg: '#C2410C', bar: '#EA580C' },
  critico: { label: 'Crítica', icon: 'close-circle', bg: colors.dangerSoft, fg: colors.dangerText, bar: colors.danger },
};

export const nivelInfo = (nivel) =>
  NIVELES[nivel] || { label: 'Sin datos', icon: 'help-circle-outline', bg: colors.neutralSoft, fg: colors.textMuted, bar: colors.border };

export const TIPOS_ATAQUE = {
  phishing: { icon: 'mail-outline', label: 'Phishing' },
  smishing: { icon: 'chatbubble-ellipses-outline', label: 'Smishing' },
  suplantacion_identidad: { icon: 'person-remove-outline', label: 'Suplantación de identidad' },
};
export const tipoInfo = (tipo) => TIPOS_ATAQUE[tipo] || { icon: 'shield-outline', label: tipo };

export const DIFICULTADES = {
  basico: { label: 'Básico', nivel: 1 },
  intermedio: { label: 'Intermedio', nivel: 2 },
  avanzado: { label: 'Avanzado', nivel: 3 },
};

export const TIPOS_ACCION = {
  segura: { label: 'Segura', bg: colors.successSoft, fg: colors.successText },
  neutral: { label: 'Neutral', bg: colors.neutralSoft, fg: colors.textMuted },
  riesgosa: { label: 'Riesgosa', bg: colors.warningSoft, fg: colors.warningText },
  critica: { label: 'Crítica', bg: colors.dangerSoft, fg: colors.dangerText },
};

export const VALORACIONES = {
  correcta: { label: 'Decisión segura', icono: '✓', icon: 'checkmark-circle', fg: colors.successText, bg: colors.successSoft },
  mejorable: { label: 'Decisión mejorable', icono: '•', icon: 'remove-circle', fg: colors.warningText, bg: colors.warningSoft },
  incorrecta: { label: 'Decisión riesgosa', icono: '✕', icon: 'close-circle', fg: colors.dangerText, bg: colors.dangerSoft },
};

export const ESTADOS_ESCENARIO = {
  activo: { label: 'Activo', icon: 'checkmark-circle', bg: colors.successSoft, fg: colors.successText },
  borrador: { label: 'Borrador', icon: 'create-outline', bg: colors.primarySoft, fg: colors.primary },
  inactivo: { label: 'Inactivo', icon: 'pause-circle', bg: colors.warningSoft, fg: colors.warningText },
  eliminado: { label: 'Eliminado', icon: 'trash-outline', bg: colors.neutralSoft, fg: colors.textMuted },
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
