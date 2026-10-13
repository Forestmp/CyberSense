import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from './ui';
import { colors, fonts, space } from '../theme';

/** Barra de navegación inferior (se usa como `tabBar` de las pestañas). */
export function BottomNav({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, space(2)) }]} accessibilityRole="tablist">
      <View style={styles.interior}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const activo = state.index === index;
          const onPress = () => {
            const evento = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!activo && !evento.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const [iconoActivo, iconoInactivo] = options.tabBarIconNames || ['ellipse', 'ellipse-outline'];
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={options.title}
              style={styles.item}
            >
              <View style={[styles.pastilla, activo && styles.pastillaActiva]}>
                <Ionicons name={activo ? iconoActivo : iconoInactivo} size={22} color={activo ? colors.primary : colors.textMuted} />
              </View>
              <Text style={[styles.texto, activo && styles.textoActivo]} numberOfLines={1}>{options.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingTop: space(2) },
  interior: { flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center' },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  pastilla: { paddingHorizontal: space(4), paddingVertical: space(1), borderRadius: 999 },
  pastillaActiva: { backgroundColor: colors.primarySoft },
  texto: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted },
  textoActivo: { color: colors.primary, fontFamily: fonts.semibold },
});
