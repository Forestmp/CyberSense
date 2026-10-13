import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from './ui';
import { colors, radius, shadow, space, type } from '../theme';

/** Sección plegable con ícono, título y contador opcional. */
export function Accordion({ icon, iconColor = colors.primary, title, count, defaultOpen = false, children }) {
  const [abierto, setAbierto] = useState(defaultOpen);
  return (
    <View style={[styles.contenedor, shadow.sm]}>
      <Pressable
        onPress={() => setAbierto((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${title}${count != null ? `, ${count}` : ''}`}
        style={({ pressed }) => [styles.encabezado, pressed && { backgroundColor: colors.bg }]}
      >
        <View style={[styles.icono, { backgroundColor: `${iconColor}1A` }]}><Ionicons name={icon} size={18} color={iconColor} /></View>
        <Text style={[type.h3, { flex: 1 }]}>{title}</Text>
        {count != null ? <View style={styles.contador}><Text style={type.caption}>{count}</Text></View> : null}
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
      </Pressable>
      {abierto ? <View style={styles.cuerpo}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) },
  icono: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  contador: { backgroundColor: colors.neutralSoft, borderRadius: 999, paddingHorizontal: space(2.5), paddingVertical: 2 },
  cuerpo: { paddingHorizontal: space(4), paddingBottom: space(4), gap: space(3), borderTopWidth: 1, borderColor: colors.border, paddingTop: space(3) },
});
