import { Text, View } from 'react-native';
import { Ionicons } from './ui';
import { reglasPassword } from '../lib/validacion';
import { colors, space, type } from '../theme';

/** Lista de requisitos de la contraseña que se marca conforme se cumplen. */
export function PasswordRules({ password }) {
  return (
    <View style={{ gap: space(1), marginTop: -space(1) }} accessibilityLabel="Requisitos de la contraseña">
      {reglasPassword(password).map((r) => (
        <View key={r.texto} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
          <Ionicons name={r.ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={r.ok ? colors.success : colors.textMuted} />
          <Text style={[type.small, r.ok && { color: colors.successText }]}>{r.texto}</Text>
        </View>
      ))}
    </View>
  );
}
