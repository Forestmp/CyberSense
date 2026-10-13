import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { NivelBadge } from '../../../components/NivelBadge';
import { Badge, Button, Card, ErrorState, Ionicons, Loading, Marca, ProgressBar, Screen, SectionTitle } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { fechaHora, nivelInfo, puntos, tipoInfo } from '../../../lib/etiquetas';
import { colors, fonts, radius, space, type } from '../../../theme';

function Acceso({ icon, titulo, descripcion, onPress }) {
  return (
    <Card onPress={onPress} style={styles.acceso} accessibilityLabel={titulo}>
      <View style={styles.accesoIcono}><Ionicons name={icon} size={22} color={colors.primary} /></View>
      <Text style={type.h3}>{titulo}</Text>
      <Text style={type.small} numberOfLines={2}>{descripcion}</Text>
    </Card>
  );
}

const saludo = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export default function Dashboard() {
  const router = useRouter();
  const { usuario, esAdmin } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [metricas, historial, rec] = await Promise.all([
        api(`/users/${usuario.id}/metrics`),
        api(`/users/${usuario.id}/history`, { query: { limite: 1 } }),
        api('/scenarios/recommended'),
      ]);
      setDatos({ metricas, ultima: historial.datos[0] || null, recomendacion: rec.recomendacion });
    } catch (e) {
      setError(e.message);
    }
  }, [usuario.id]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (!datos && !error) return <Loading />;
  if (!datos) return <Screen edges={['top']}><ErrorState message="No fue posible cargar tu información. Intenta nuevamente." onRetry={cargar} /></Screen>;

  const { resumen } = datos.metricas;
  const progreso = resumen.escenarios_disponibles ? (resumen.escenarios_completados / resumen.escenarios_disponibles) * 100 : 0;
  const nivel = nivelInfo(resumen.nivel_vulnerabilidad);
  const ultima = datos.ultima;

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}>
      <View style={styles.top}>
        <Marca tamano={30} />
        {esAdmin ? <Badge tone="info" icon="key-outline" label="Admin" /> : null}
      </View>

      <View style={{ gap: 2 }}>
        <Text style={type.small}>{saludo()},</Text>
        <Text style={type.display}>{usuario.nombre.split(' ')[0]}</Text>
      </View>

      {/* Tarjeta destacada: estado actual + acción principal */}
      <View style={styles.hero}>
        <View style={styles.heroFila}>
          <View style={{ flex: 1, gap: space(1) }}>
            <Text style={styles.heroEtiqueta}>TU NIVEL DE VULNERABILIDAD</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Ionicons name={nivel.icon} size={24} color={resumen.nivel_vulnerabilidad ? '#FFFFFF' : '#93C5FD'} />
              <Text style={styles.heroNivel}>{resumen.nivel_vulnerabilidad ? nivel.label : 'Aún sin evaluar'}</Text>
            </View>
          </View>
          <View style={styles.heroPuntaje}>
            <Text style={styles.heroPuntajeValor}>{puntos(resumen.puntaje_promedio)}</Text>
            <Text style={styles.heroPuntajeEtiqueta}>promedio</Text>
          </View>
        </View>
        <View style={{ gap: space(1.5) }}>
          <View style={styles.heroFila}>
            <Text style={styles.heroTexto}>Progreso general</Text>
            <Text style={styles.heroTexto}>{resumen.escenarios_completados} de {resumen.escenarios_disponibles} escenarios</Text>
          </View>
          <ProgressBar value={progreso} color={colors.cyan} track="rgba(255,255,255,0.18)" label="Progreso general" />
        </View>
        <Button title="Iniciar simulación" size="lg" variant="light" icon="play" onPress={() => router.push('/simulaciones')} />
        {datos.recomendacion ? (
          <Text style={styles.heroTexto}>
            <Text style={{ fontFamily: fonts.semibold, color: '#FFFFFF' }}>Sugerido: </Text>
            {datos.recomendacion.escenario.titulo} · {datos.recomendacion.motivo}
          </Text>
        ) : null}
      </View>

      <SectionTitle>Última simulación</SectionTitle>
      {ultima ? (
        <Card onPress={() => router.push(`/resultado/${ultima.intento_id}`)} style={styles.ultima} accessibilityLabel={`Última simulación: ${ultima.titulo}`}>
          <View style={styles.accesoIcono}><Ionicons name={tipoInfo(ultima.tipo).icon} size={22} color={colors.primary} /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={type.h3} numberOfLines={1}>{ultima.titulo}</Text>
            <Text style={type.small}>{ultima.tipo_nombre} · {fechaHora(ultima.fecha_fin)}</Text>
            <NivelBadge nivel={ultima.nivel_vulnerabilidad} prefijo="" />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.puntaje}>{puntos(ultima.puntaje)}</Text>
            <Text style={type.caption}>/ 100</Text>
          </View>
        </Card>
      ) : (
        <Card variant="soft" elevated={false} style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
          <Ionicons name="rocket-outline" size={24} color={colors.primary} />
          <Text style={[type.body, { flex: 1 }]}>Aún no realizas simulaciones. Comienza con el escenario sugerido.</Text>
        </Card>
      )}

      <SectionTitle>Accesos</SectionTitle>
      <View style={styles.grid}>
        <Acceso icon="stats-chart-outline" titulo="Mi progreso" descripcion="Desempeño por tipo de ataque" onPress={() => router.push('/progreso')} />
        <Acceso icon="time-outline" titulo="Historial" descripcion="Simulaciones realizadas" onPress={() => router.push('/historial')} />
        <Acceso icon="book-outline" titulo="Aprender" descripcion="Señales de alerta y buenas prácticas" onPress={() => router.push('/aprender')} />
        <Acceso icon="person-circle-outline" titulo="Perfil" descripcion="Tu cuenta y contraseña" onPress={() => router.push('/perfil')} />
      </View>

      {esAdmin ? (
        <>
          <SectionTitle>Administración</SectionTitle>
          <View style={styles.grid}>
            <Acceso icon="layers-outline" titulo="Escenarios" descripcion="Crear, editar y desactivar" onPress={() => router.push('/admin/escenarios')} />
            <Acceso icon="people-outline" titulo="Usuarios" descripcion="Cuentas y roles" onPress={() => router.push('/admin/usuarios')} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: {
    backgroundColor: colors.navy, borderRadius: radius.xl, padding: space(5), gap: space(4),
    // Degradado sutil (si la plataforma no lo soporta queda el azul marino sólido).
    experimental_backgroundImage: 'linear-gradient(135deg, #0B1F4D 0%, #143A86 100%)',
  },
  heroFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  heroEtiqueta: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: '#93C5FD' },
  heroNivel: { fontFamily: fonts.bold, fontSize: 22, color: '#FFFFFF' },
  heroPuntaje: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg, paddingHorizontal: space(4), paddingVertical: space(2) },
  heroPuntajeValor: { fontFamily: fonts.extrabold, fontSize: 26, color: '#FFFFFF' },
  heroPuntajeEtiqueta: { fontFamily: fonts.medium, fontSize: 11, color: '#BFDBFE' },
  heroTexto: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#CBD5E1' },
  ultima: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  puntaje: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  acceso: { flexGrow: 1, flexBasis: '45%', gap: space(1.5) },
  accesoIcono: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
