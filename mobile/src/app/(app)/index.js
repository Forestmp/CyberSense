import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, space } from '../../theme';

function Accion({ titulo, descripcion, onPress, icono }) {
  return (
    <Card onPress={onPress} style={styles.accion} accessibilityLabel={titulo}>
      <View style={styles.icono}><Text style={styles.iconoText}>{icono}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.accionTitulo}>{titulo}</Text>
        <Text style={styles.accionDesc}>{descripcion}</Text>
      </View>
      {onPress ? <Text style={styles.flecha}>›</Text> : null}
    </Card>
  );
}

export default function Inicio() {
  const router = useRouter();
  const { usuario, esAdmin, cerrarSesion } = useAuth();
  const primerNombre = usuario.nombre.split(' ')[0];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ gap: space(1), marginTop: space(2) }}>
        <Text style={styles.saludo}>Hola, {primerNombre}</Text>
        <Text style={styles.sub}>¿Listo para poner a prueba tu criterio?</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitulo}>Simulación de ataques</Text>
        <Text style={styles.heroTexto}>
          Enfrenta situaciones de phishing, smishing y suplantación de identidad en un entorno seguro. Al final recibirás retroalimentación.
        </Text>
        <Button title="Iniciar simulación" onPress={() => router.push('/simulacion')} variant="secondary" style={styles.heroBoton} />
      </View>

      <View style={{ gap: space(3) }}>
        <Accion icono="▲" titulo="Mi progreso" descripcion="Desempeño por tipo de ataque" onPress={() => router.push('/progreso')} />
        <Accion icono="≡" titulo="Historial" descripcion="Simulaciones realizadas" onPress={() => router.push('/historial')} />
        <Accion icono="●" titulo="Mi perfil" descripcion="Datos de tu cuenta" onPress={() => router.push('/perfil')} />
      </View>

      {esAdmin ? (
        <View style={{ gap: space(3) }}>
          <Text style={styles.seccion}>Administración</Text>
          <Accion icono="☰" titulo="Usuarios" descripcion="Consultar, crear, editar y eliminar" onPress={() => router.push('/admin/usuarios')} />
          <Accion icono="✎" titulo="Escenarios" descripcion="Próximamente (Etapa 3)" />
        </View>
      ) : null}

      <Button title="Cerrar sesión" variant="ghost" onPress={cerrarSesion} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  saludo: { fontSize: 26, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.textMuted },
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: space(5), gap: space(3) },
  heroTitulo: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  heroTexto: { color: '#DBEAFE', fontSize: 15, lineHeight: 21 },
  heroBoton: { borderColor: '#FFFFFF', marginTop: space(1) },
  accion: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  icono: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  iconoText: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  accionTitulo: { fontSize: 16, fontWeight: '600', color: colors.text },
  accionDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  flecha: { fontSize: 26, color: colors.textMuted },
  seccion: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space(2) },
});
