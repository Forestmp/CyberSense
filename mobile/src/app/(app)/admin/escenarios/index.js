import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../../api/client';
import { Button, Card, EmptyState, FormError, Segmented, TextField } from '../../../../components/ui';
import { avisar, confirmar } from '../../../../lib/confirm';
import { EstadoBadge } from '../../../../components/EstadoBadge';
import { colors, space } from '../../../../theme';

const FILTROS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'borrador', label: 'Borradores' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'eliminado', label: 'Eliminados' },
];

export default function AdminEscenarios() {
  const router = useRouter();
  const [buscar, setBuscar] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const r = await api('/scenarios', { query: { limite: 100, buscar: busqueda, estado } });
      setDatos(r.datos);
      setTotal(r.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [busqueda, estado]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(buscar.trim()), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  async function eliminar(e) {
    const ok = await confirmar('Eliminar escenario', `¿Eliminar «${e.titulo}» (${e.codigo})? Dejará de mostrarse, pero el historial de los usuarios se conserva.`, 'Eliminar');
    if (!ok) return;
    try {
      await api(`/scenarios/${e.id}`, { method: 'DELETE' });
      cargar();
    } catch (err) {
      avisar('No se pudo eliminar', err.message);
    }
  }

  const renderItem = ({ item: e }) => (
    <Card style={{ gap: space(2.5) }}>
      <View style={styles.filaTop}>
        <Text style={styles.codigo}>{e.codigo}</Text>
        <EstadoBadge estado={e.estado} />
      </View>
      <Text style={styles.titulo}>{e.titulo}</Text>
      <Text style={styles.meta}>{e.tipo_nombre} · {e.dificultad_nombre}</Text>
      <View style={styles.acciones}>
        <Button small title="Ver" variant="secondary" onPress={() => router.push(`/admin/escenarios/${e.id}`)} style={{ flex: 1 }} />
        {e.estado !== 'eliminado' ? (
          <>
            <Button small title="Editar" variant="secondary" onPress={() => router.push({ pathname: '/admin/escenarios/editor', params: { id: e.id } })} style={{ flex: 1 }} />
            <Button small title="Eliminar" variant="danger" onPress={() => eliminar(e)} style={{ flex: 1 }} />
          </>
        ) : null}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <FlatList
        data={datos}
        keyExtractor={(e) => String(e.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space(3), marginBottom: space(1) }}>
            <Button title="+ Nuevo escenario" onPress={() => router.push('/admin/escenarios/editor')} />
            <TextField placeholder="Buscar por título o código" value={buscar} onChangeText={setBuscar} autoCapitalize="none" />
            <Segmented options={FILTROS} value={estado} onChange={setEstado} />
            <FormError message={error} />
            <Text style={styles.meta}>{total} escenario(s)</Text>
          </View>
        }
        ListEmptyComponent={!cargando ? <EmptyState title="Sin escenarios" message="No hay escenarios con estos criterios." /> : null}
        ListFooterComponent={cargando ? <ActivityIndicator color={colors.primary} style={{ margin: space(4) }} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lista: { padding: space(5), gap: space(3), width: '100%', maxWidth: 720, alignSelf: 'center' },
  filaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codigo: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  titulo: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  acciones: { flexDirection: 'row', gap: space(2) },
});
