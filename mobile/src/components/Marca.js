import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';

export function Marca() {
  return (
    <View style={marca.wrap}>
      <View style={marca.logo}><Text style={marca.logoText}>!</Text></View>
      <Text style={marca.nombre}>Alerta ante la ingeniería social</Text>
      <Text style={marca.sub}>Simulaciones educativas · ESCOM-IPN</Text>
    </View>
  );
}

const marca = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space(1.5), marginBottom: space(4) },
  logo: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
  nombre: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textMuted },
});
