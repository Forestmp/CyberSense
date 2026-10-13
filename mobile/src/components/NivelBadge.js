import { Text, View } from 'react-native';
import { Ionicons } from './ui';
import { nivelInfo } from '../lib/etiquetas';
import { fonts, radius, space } from '../theme';

/** Nivel de vulnerabilidad con ícono y texto, no solo color. */
export function NivelBadge({ nivel, prefijo = 'Vulnerabilidad', grande = false }) {
  const n = nivelInfo(nivel);
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space(1.5), alignSelf: 'flex-start',
        backgroundColor: n.bg, borderRadius: radius.pill,
        paddingHorizontal: grande ? space(4) : space(2.5), paddingVertical: grande ? space(2) : 3,
      }}
      accessibilityLabel={`${prefijo} ${n.label}`}
    >
      <Ionicons name={n.icon} size={grande ? 18 : 13} color={n.fg} />
      <Text style={{ color: n.fg, fontFamily: fonts.semibold, fontSize: grande ? 15 : 12 }}>
        {prefijo ? `${prefijo} ${n.label.toLowerCase()}` : n.label}
      </Text>
    </View>
  );
}
