import { Text, View } from 'react-native';
import { ESTADOS_ESCENARIO } from '../lib/etiquetas';
import { radius, space } from '../theme';

export function EstadoBadge({ estado }) {
  const e = ESTADOS_ESCENARIO[estado] || ESTADOS_ESCENARIO.borrador;
  return (
    <View style={[{ borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: 2 }, { backgroundColor: e.bg }]}>
      <Text style={{ color: e.fg, fontSize: 12, fontWeight: '700' }}>{e.label}</Text>
    </View>
  );
}
