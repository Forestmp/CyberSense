import { forwardRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space } from '../theme';

/** Contenedor de pantalla con scroll y ancho máximo (útil en web/tablet). */
export function Screen({ children, scroll = true, edges = ['bottom'], contentStyle }) {
  const contenido = <View style={[styles.screenInner, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{contenido}</ScrollView>
      ) : contenido}
    </SafeAreaView>
  );
}

export function Title({ children, style }) {
  return <Text style={[styles.title, style]} accessibilityRole="header">{children}</Text>;
}

export function Subtitle({ children, style }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function Card({ children, style, onPress, accessibilityLabel }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

const variantes = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style, small = false }) {
  const v = variantes[variant];
  const inactivo = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        inactivo && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>}
    </Pressable>
  );
}

export const TextField = forwardRef(function TextField({ label, error, secure = false, hint, style, inputStyle, multiline, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, error && { borderColor: colors.danger }]}>
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && !visible}
          accessibilityLabel={label}
          {...props}
        />
        {secure ? (
          <Pressable onPress={() => setVisible((v) => !v)} accessibilityRole="button" style={styles.eye}>
            <Text style={styles.eyeText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

export function FormError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.formError} accessibilityRole="alert">
      <Text style={{ color: colors.danger }}>{message}</Text>
    </View>
  );
}

const badgeColores = {
  activo: [colors.successSoft, colors.success],
  admin: [colors.primarySoft, colors.primaryDark],
  usuario: [colors.neutralSoft, colors.textMuted],
  inactivo: [colors.warningSoft, colors.warning],
  bloqueado: [colors.dangerSoft, colors.danger],
  eliminado: [colors.neutralSoft, colors.textMuted],
};

export function Badge({ value, label }) {
  const [bg, fg] = badgeColores[value] || [colors.neutralSoft, colors.textMuted];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label || value}</Text>
    </View>
  );
}

/** Selector de una opción entre varias (chips). */
export function Segmented({ label, options, value, onChange }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segmented}>
        {options.map((o) => {
          const activo = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[styles.chip, activo && styles.chipActive]}
            >
              <Text style={[styles.chipText, activo && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function EmptyState({ title, message, children }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyText}>{message}</Text> : null}
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  screenInner: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: space(5), gap: space(4) },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space(4),
    borderWidth: 1, borderColor: colors.border,
  },
  button: {
    minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space(4),
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space(3) },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { gap: space(1.5) },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  input: { flex: 1, minHeight: 48, paddingHorizontal: space(3.5), fontSize: 16, color: colors.text },
  inputMultiline: { minHeight: 96, paddingTop: space(3), paddingBottom: space(3), textAlignVertical: 'top' },
  eye: { paddingHorizontal: space(3), paddingVertical: space(2) },
  eyeText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13 },
  formError: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space(3) },
  badge: { borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: space(0.5), alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    borderRadius: 999, paddingHorizontal: space(3.5), paddingVertical: space(2),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: { alignItems: 'center', padding: space(8), gap: space(2) },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
