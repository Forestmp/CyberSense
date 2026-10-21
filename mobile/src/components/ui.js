/**
 * Componentes base de CyberSense. Todas las pantallas los usan para mantener
 * una identidad visual consistente.
 */
import { forwardRef, useState } from 'react';
import {
  ActivityIndicator, Image, Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, shadow, space, type } from '../theme';

export { Ionicons };

/* ------------------------------------------------------------------ Logo */

const LOGO_COMPLETO = require('../../assets/logo-cybersense.png');
const LOGO_ESCUDO = require('../../assets/logo-escudo.png');

/** Logo oficial. `completo` incluye la palabra CyberSense; se respeta la proporción original. */
export function Logo({ variante = 'completo', ancho = 200, style }) {
  const completo = variante === 'completo';
  return (
    <Image
      source={completo ? LOGO_COMPLETO : LOGO_ESCUDO}
      // Alto explícito con la proporción original: en web `aspectRatio` no basta con <Image>.
      style={[{ width: ancho, height: completo ? Math.round((ancho * 509) / 720) : ancho }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="CyberSense"
    />
  );
}

/** Escudo + nombre en una línea, para encabezados. */
export function Marca({ tamano = 28 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }} accessibilityRole="header" accessibilityLabel="CyberSense">
      <Logo variante="escudo" ancho={tamano} />
      <Text style={{ fontFamily: fonts.extrabold, fontSize: tamano * 0.68, color: colors.navy, letterSpacing: -0.3 }}>
        Cyber<Text style={{ color: colors.bright }}>Sense</Text>
      </Text>
    </View>
  );
}

/* ---------------------------------------------------------------- Layout */

/** Contenedor de pantalla con scroll y ancho máximo (cómodo en tablet y escritorio). */
export function Screen({ children, scroll = true, edges = ['bottom'], contentStyle, maxWidth = 560, refreshControl }) {
  const contenido = <View style={[styles.screenInner, { maxWidth }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
          {contenido}
        </ScrollView>
      ) : contenido}
    </SafeAreaView>
  );
}

/** Encabezado dentro del contenido: título, subtítulo y acción opcional. */
export function Header({ title, subtitle, right, overline }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: space(1) }}>
        {overline ? <Text style={type.overline}>{overline}</Text> : null}
        <Text style={type.h1} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={[type.body, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={type.h2} accessibilityRole="header">{children}</Text>
      {right}
    </View>
  );
}

export const Title = ({ children, style }) => <Text style={[type.h1, style]} accessibilityRole="header">{children}</Text>;
export const Subtitle = ({ children, style }) => <Text style={[type.body, { color: colors.textMuted }, style]}>{children}</Text>;

/* ------------------------------------------------------------------ Card */

const CARD_VARIANTES = {
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  soft: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  navy: { backgroundColor: colors.navy, borderColor: colors.navy },
  outline: { backgroundColor: 'transparent', borderColor: colors.border },
};

export function Card({ children, style, onPress, variant = 'default', accessibilityLabel, elevated = true }) {
  const base = [styles.card, CARD_VARIANTES[variant], elevated && variant === 'default' && shadow.md, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, hovered }) => [...base, hovered && styles.cardHover, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }]}
    >
      {children}
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Button */

const BOTON_VARIANTES = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
  outline: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.surface, fg: colors.dangerText, border: '#FCA5A5' },
  dangerSolid: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  light: { bg: '#FFFFFF', fg: colors.navy, border: '#FFFFFF' },
};

export function Button({
  title, onPress, variant = 'primary', loading = false, disabled = false, style, small = false, size,
  icon, iconRight, accessibilityLabel,
}) {
  const v = BOTON_VARIANTES[variant] || BOTON_VARIANTES.primary;
  const tam = size || (small ? 'sm' : 'md');
  const inactivo = disabled || loading;
  const icono = (name) => <Ionicons name={name} size={tam === 'sm' ? 16 : 19} color={v.fg} />;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: inactivo, busy: loading }}
      style={({ pressed, hovered }) => [
        styles.button,
        styles[`button_${tam}`],
        { backgroundColor: v.bg, borderColor: v.border },
        variant === 'primary' && shadow.sm,
        hovered && !inactivo && { opacity: 0.92 },
        pressed && { opacity: 0.82 },
        inactivo && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon ? icono(icon) : null}
          {title ? <Text style={[styles.buttonText, styles[`buttonText_${tam}`], { color: v.fg }]}>{title}</Text> : null}
          {iconRight ? icono(iconRight) : null}
        </>
      )}
    </Pressable>
  );
}

/** Botón solo con ícono (requiere etiqueta accesible). */
export function IconButton({ icon, onPress, label, color = colors.textMuted, size = 22, style }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.neutralSoft }, style]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

/* ----------------------------------------------------------------- Input */

export const Input = forwardRef(function Input(
  { label, error, secure = false, hint, style, inputStyle, multiline, icon, valid, ...props }, ref
) {
  const [visible, setVisible] = useState(false);
  const [foco, setFoco] = useState(false);
  const borde = error ? colors.danger : foco ? colors.primary : colors.border;
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, { borderColor: borde }, foco && styles.inputFoco]}>
        {icon ? <Ionicons name={icon} size={18} color={foco ? colors.primary : colors.textMuted} style={{ marginLeft: space(3.5) }} /> : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          multiline={multiline}
          placeholderTextColor="#94A3B8"
          secureTextEntry={secure && !visible}
          accessibilityLabel={label || props.placeholder}
          accessibilityHint={error || hint}
          onFocus={(e) => { setFoco(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFoco(false); props.onBlur?.(e); }}
          {...props}
        />
        {valid && !error ? <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: space(3) }} accessibilityLabel="Válido" /> : null}
        {secure ? (
          <Pressable onPress={() => setVisible((v) => !v)} accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={styles.eye} hitSlop={6}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.inlineMsg}>
          <Ionicons name="alert-circle" size={15} color={colors.dangerText} />
          <Text style={[type.small, { color: colors.dangerText, flex: 1 }]}>{error}</Text>
        </View>
      ) : hint ? <Text style={type.small}>{hint}</Text> : null}
    </View>
  );
});

/** Nombre heredado, equivalente a Input. */
export const TextField = Input;

/* ----------------------------------------------------------------- Alert */

const TONOS = {
  info: { bg: colors.primarySoft, fg: colors.navy, icon: 'information-circle', iconColor: colors.primary },
  success: { bg: colors.successSoft, fg: '#14532D', icon: 'checkmark-circle', iconColor: colors.success },
  warning: { bg: colors.warningSoft, fg: '#78350F', icon: 'warning', iconColor: colors.warningText },
  error: { bg: colors.dangerSoft, fg: '#7F1D1D', icon: 'alert-circle', iconColor: colors.danger },
};

export function Alert({ tone = 'info', title, message, children, style }) {
  const t = TONOS[tone];
  return (
    <View style={[styles.alert, { backgroundColor: t.bg }, style]} accessibilityRole="alert">
      <Ionicons name={t.icon} size={20} color={t.iconColor} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={[type.bodyStrong, { color: t.fg }]}>{title}</Text> : null}
        {message ? <Text style={[type.small, { color: t.fg }]}>{message}</Text> : null}
        {children}
      </View>
    </View>
  );
}

/** Mensaje de error de formulario (nombre heredado). */
export function FormError({ message }) {
  return message ? <Alert tone="error" message={message} /> : null;
}

/* ----------------------------------------------------------------- Badge */

const BADGE_TONOS = {
  info: [colors.primarySoft, colors.primary],
  navy: [colors.navy, '#FFFFFF'],
  success: [colors.successSoft, colors.successText],
  warning: [colors.warningSoft, colors.warningText],
  danger: [colors.dangerSoft, colors.dangerText],
  neutral: [colors.neutralSoft, colors.textMuted],
};
// Compatibilidad con valores usados por pantallas existentes.
const BADGE_POR_VALOR = { activo: 'success', admin: 'info', usuario: 'neutral', inactivo: 'warning', bloqueado: 'danger', eliminado: 'neutral' };

export function Badge({ tone, value, label, icon, style }) {
  const [bg, fg] = BADGE_TONOS[tone || BADGE_POR_VALOR[value] || 'neutral'];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{label || value}</Text>
    </View>
  );
}

/* ----------------------------------------------------------- ProgressBar */

export function ProgressBar({ value = 0, color = colors.primary, height = 8, label, track = colors.neutralSoft }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View
      style={[styles.barTrack, { height, borderRadius: height / 2, backgroundColor: track }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}
    >
      <View style={{ width: `${v}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/* --------------------------------------------------------------- Chips */

/** Selector de una opción entre varias. */
export function Segmented({ label, options, value, onChange }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const activo = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo, checked: activo }}
              style={({ pressed }) => [styles.chip, activo && styles.chipActive, pressed && { opacity: 0.85 }]}
            >
              {activo ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              <Text style={[styles.chipText, activo && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------- Modal */

export function Modal({ visible, onClose, title, message, icon, iconColor = colors.primary, children, actions }) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalFondo} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable style={[styles.modal, shadow.lg]} onPress={() => {}} accessibilityViewIsModal>
          {icon ? (
            <View style={[styles.modalIcono, { backgroundColor: `${iconColor}1A` }]}>
              <Ionicons name={icon} size={26} color={iconColor} />
            </View>
          ) : null}
          {title ? <Text style={[type.h2, { textAlign: 'center' }]}>{title}</Text> : null}
          {message ? <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text> : null}
          {children}
          {actions ? <View style={{ gap: space(2), alignSelf: 'stretch', marginTop: space(2) }}>{actions}</View> : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

/* --------------------------------------------------- Estados de pantalla */

export function Loading({ message }) {
  return (
    <View style={styles.center} accessibilityLabel={message || 'Cargando'}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={[type.small, { marginTop: space(3) }]}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = 'sparkles-outline', title, message, children }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcono}><Ionicons name={icon} size={30} color={colors.primary} /></View>
      <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text> : null}
      {children}
    </View>
  );
}

export function ErrorState({ message = 'No fue posible cargar la información. Intenta nuevamente.', onRetry }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcono, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
      </View>
      <Text style={[type.h3, { textAlign: 'center' }]}>Algo salió mal</Text>
      <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text>
      {onRetry ? <Button title="Reintentar" icon="refresh" variant="outline" onPress={onRetry} style={{ marginTop: space(2), alignSelf: 'center' }} /> : null}
    </View>
  );
}

/* ---------------------------------------------------------------- Estilos */

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenInner: { flex: 1, width: '100%', alignSelf: 'center', padding: space(5), gap: space(4) },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(2) },
  card: { borderRadius: radius.lg, padding: space(4), borderWidth: 1 },
  cardHover: { borderColor: '#BFD4FB' },
  button: {
    borderRadius: radius.md, borderWidth: 1.5, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: space(2), paddingHorizontal: space(4),
  },
  button_sm: { minHeight: 38, paddingHorizontal: space(3), borderRadius: radius.sm },
  button_md: { minHeight: 50 },
  button_lg: { minHeight: 58, borderRadius: radius.lg },
  buttonText: { fontFamily: fonts.semibold },
  buttonText_sm: { fontSize: 14 },
  buttonText_md: { fontSize: 16 },
  buttonText_lg: { fontSize: 17, fontFamily: fonts.bold },
  iconButton: { padding: space(2), borderRadius: radius.pill },
  field: { gap: space(1.5) },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
  },
  inputFoco: { boxShadow: '0px 0px 0px 3px rgba(37, 99, 235, 0.15)' },
  // minWidth 0: en web el campo no se encoge y los íconos se salen; outline: el foco ya se marca en el contenedor.
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: space(3.5), fontSize: 16, fontFamily: fonts.regular, color: colors.text, outlineStyle: 'none' },
  inputMultiline: { minHeight: 100, paddingTop: space(3), paddingBottom: space(3), textAlignVertical: 'top' },
  eye: { paddingHorizontal: space(3), paddingVertical: space(2) },
  inlineMsg: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  alert: { flexDirection: 'row', gap: space(3), borderRadius: radius.md, padding: space(3.5), alignItems: 'flex-start' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill,
    paddingHorizontal: space(2.5), paddingVertical: 3, alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: fonts.semibold },
  barTrack: { width: '100%', overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(2),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  chipTextActive: { color: '#FFFFFF' },
  modalFondo: { flex: 1, backgroundColor: 'rgba(11, 31, 77, 0.45)', alignItems: 'center', justifyContent: 'center', padding: space(5) },
  modal: {
    width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: space(6), gap: space(3), alignItems: 'center',
  },
  modalIcono: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space(6) },
  empty: { alignItems: 'center', padding: space(8), gap: space(2.5) },
  emptyIcono: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space(1) },
});
