import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { Button, Card, EmptyState, FormError } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { fechaHora, nivelInfo, puntos } from '../../lib/etiquetas';
import { colors, radius, space } from '../../theme';

export default function Historial() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [datos, setDatos] = useState([]);
  const [meta, setMeta] = useState({ pagina: 1, paginas: 1, total: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async (pagina = 1) => {
    setCargando(true);
    try {
      const r = await api(`/users/${usuario.id}/history`, { query: { pagina, limite: 20 } });
      setDatos((prev) => (pagina === 1 ? r.datos : [...prev, ...r.datos]));
      setMeta({ pagina: r.pagina, paginas: r.paginas, total: r.total });
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [usuario.id]);

  useFocusEffect(useCallback(() => { cargar(1); }, [cargar]));

  const renderItem = ({ item: h }) => {
    const nivel = nivelInfo(h.nivel_vulnerabilidad);
    return (
      <Card onPress={() => router.push(`/resultado/${h.intento_id}`)} style={styles.fila} accessibilityLabel={`${h.titulo}, ${puntos(h.puntaje)} puntos`}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.titulo} numberOfLines={1}>{h.titulo}</Text>
          <Text style={styles.meta}>{h.tipo_nombre} · {h.codigo} · intento {h.numero_intento}</Text>
          <Text style={styles.meta}>{fechaHora(h.fecha_fin)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: space(1) }}>
          <Text style={styles.puntaje}>{puntos(h.puntaje)}</Text>
          <View style={[styles.pill, { backgroundColor: nivel.bg }]}>
            <Text style={{ color: nivel.fg, fontSize: 12, fontWeight: '700' }}>{nivel.label}</Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <FlatList
        data={datos}
        keyExtractor={(h) => String(h.intento_id)}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <View style={{ gap: space(2) }}>
            <FormError message={error} />
            {meta.total ? <Text style={styles.meta}>{meta.total} simulación(es) · puntaje / vulnerabilidad</Text> : null}
          </View>
        }
        ListEmptyComponent={!cargando ? (
          <EmptyState title="Aún no hay historial" message="Completa una simulación y aparecerá aquí con su puntuación y nivel de vulnerabilidad.">
            <Button title="Iniciar simulación" onPress={() => router.push('/simulacion')} style={{ marginTop: space(3) }} />
          </EmptyState>
        ) : null}
        ListFooterComponent={
          cargando ? <ActivityIndicator color={colors.primary} style={{ margin: space(4) }} />
            : meta.pagina < meta.paginas ? <Button title="Cargar más" variant="ghost" onPress={() => cargar(meta.pagina + 1)} /> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lista: { padding: space(5), gap: space(3), width: '100%', maxWidth: 560, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  titulo: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  puntaje: { fontSize: 22, fontWeight: '800', color: colors.text },
  pill: { borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: 2 },
});
