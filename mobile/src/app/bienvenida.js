import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Ionicons, Logo } from '../components/ui';
import { colors, fonts, radius, space, type } from '../theme';

const PUNTOS = [
  { icon: 'mail-unread-outline', texto: 'Practica con correos, SMS y sitios simulados' },
  { icon: 'shield-checkmark-outline', texto: 'Aprende a reconocer señales de alerta' },
  { icon: 'stats-chart-outline', texto: 'Mide tu progreso y tu nivel de vulnerabilidad' },
];

export default function Bienvenida() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.fondo} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.contenido}>
        <View style={styles.marca}>
          <Logo ancho={230} />
          <Text style={styles.lema}>Aprende a identificar riesgos digitales antes de que sea demasiado tarde.</Text>
        </View>

        <View style={styles.puntos}>
          {PUNTOS.map((p) => (
            <View key={p.icon} style={styles.punto}>
              <View style={styles.puntoIcono}><Ionicons name={p.icon} size={20} color={colors.primary} /></View>
              <Text style={[type.body, { flex: 1 }]}>{p.texto}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: space(3) }}>
          <Button title="Iniciar sesión" size="lg" onPress={() => router.push('/login')} />
          <Button title="Crear cuenta" size="lg" variant="outline" onPress={() => router.push('/registro')} />
          <Text style={styles.pie}>Simulaciones educativas controladas · ESCOM-IPN</Text>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.surface },
  contenido: {
    flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center', padding: space(6),
    justifyContent: 'space-between', gap: space(6),
  },
  marca: { alignItems: 'center', gap: space(5), marginTop: space(6) },
  lema: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 25, color: colors.textMuted, textAlign: 'center', maxWidth: 340 },
  puntos: { gap: space(3), backgroundColor: colors.bg, borderRadius: radius.lg, padding: space(4) },
  punto: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  puntoIcono: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pie: { ...type.caption, textAlign: 'center', marginTop: space(1) },
});
