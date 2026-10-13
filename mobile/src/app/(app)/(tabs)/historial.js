import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../api/client';
import { NivelBadge } from '../../../components/NivelBadge';
import { Dificultad } from '../../../components/ScenarioCard';
import { Button, Card, EmptyState, ErrorState, Ionicons, Loading, Segmented } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { fechaHora, puntos, tipoInfo } from '../../../lib/etiquetas';
import { colors, fonts, radius, space, type } from '../../../theme';

export default function Historial() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [datos, setDatos] = useState(null);
  const [meta, setMeta] = useState({ pagina: 1, paginas: 1, total: 0 });
  const [tipo, setTipo] = useState('');
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async (pagina = 1) => {
    setError('');
    if (pagina > 1) setCargandoMas(true);
    try {
      const r = await api(`/users/${usuario.id}/history`, { query: { pagina, limite: 20, tipo } });
      setDatos((prev) => (pagina === 1 ? r.datos : [...(prev || []), ...r.datos]));
      setMeta({ pagina: r.pagina, paginas: r.paginas, total: r.total });
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoMas(false);
    }
  }, [usuario.id, tipo]);

  useFocusEffect(useCallback(() => { cargar(1); }, [cargar]));

  if (error && !datos) return <ErrorState message="No fue posible cargar tu historial. Intenta nuevamente." onRetry={() => cargar(1)} />;
  if (!datos) return <Loading />;

  const renderItem = ({ item: h }) => (
    <Card onPress={() => router.push(`/resultado/${h.intento_id}`)} style={styles.fila} accessibilityLabel={`${h.titulo}, ${puntos(h.puntaje)} puntos, ver detalles`}>
      <View style={styles.icono}><Ionicons name={tipoInfo(h.tipo).icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={type.h3} numberOfLines={1}>{h.titulo}</Text>
        <Text style={type.caption}>{h.tipo_nombre} · {fechaHora(h.fecha_fin)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap' }}>
          <Dificultad clave={h.dificultad} nombre={h.dificultad_nombre} />
          <NivelBadge nivel={h.nivel_vulnerabilidad} prefijo="" />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={styles.puntaje}>{puntos(h.puntaje)}</Text>
        <Text style={type.caption}>/ 100</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={[]}>
      <FlatList
        data={datos}
        keyExtractor={(h) => String(h.intento_id)}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
        ListHeaderComponent={(
          <View style={{ gap: space(3), marginBottom: space(3) }}>
            <Segmented
              options={[{ value: '', label: 'Todos' }, { value: 'phishing', label: 'Phishing' }, { value: 'smishing', label: 'Smishing' }, { value: 'suplantacion_identidad', label: 'Suplantación' }]}
              value={tipo}
              onChange={setTipo}
            />
            {meta.total ? <Text style={type.small}>{meta.total} simulación(es) realizadas</Text> : null}
          </View>
        )}
        ListEmptyComponent={(
          <EmptyState icon="time-outline" title="Aún no hay simulaciones" message="Cuando completes un escenario aparecerá aquí con su puntuación y nivel de vulnerabilidad.">
            <Button title="Iniciar simulación" icon="play" onPress={() => router.push('/simulaciones')} style={{ marginTop: space(2), alignSelf: 'center' }} />
          </EmptyState>
        )}
        ListFooterComponent={
          cargandoMas ? <ActivityIndicator color={colors.primary} style={{ margin: space(4) }} />
            : meta.pagina < meta.paginas ? <Button title="Cargar más" variant="ghost" onPress={() => cargar(meta.pagina + 1)} style={{ marginTop: space(3) }} /> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lista: { padding: space(5), width: '100%', maxWidth: 560, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  icono: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  puntaje: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.navy },
});
