import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../../api/client';
import { Badge, Button, Card, EmptyState, FormError, Segmented, TextField } from '../../../../components/ui';
import { useAuth } from '../../../../context/AuthContext';
import { useFeedback } from '../../../../context/FeedbackContext';
import { colors, space, type } from '../../../../theme';

const FILTROS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'bloqueado', label: 'Bloqueados' },
  { value: 'eliminado', label: 'Eliminados' },
];

const formatoFecha = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

export default function AdminUsuarios() {
  const router = useRouter();
  const { usuario: yo } = useAuth();
  const { toast, confirm } = useFeedback();
  const [buscar, setBuscar] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [estado, setEstado] = useState('');
  const [datos, setDatos] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pagina: 1, paginas: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async (pagina = 1) => {
    setCargando(true);
    setError('');
    try {
      const r = await api('/users', { query: { pagina, limite: 20, buscar: busquedaAplicada, estado } });
      setDatos((prev) => (pagina === 1 ? r.datos : [...prev, ...r.datos]));
      setMeta({ total: r.total, pagina: r.pagina, paginas: r.paginas });
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [busquedaAplicada, estado]);

  // Recarga al volver de crear/editar.
  useFocusEffect(useCallback(() => { cargar(1); }, [cargar]));

  // Búsqueda con espera breve para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(buscar.trim()), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  async function eliminar(u) {
    const ok = await confirm({ title: 'Eliminar usuario', message: `¿Eliminar a ${u.nombre}? Su historial se conserva y podrás restaurarlo después.`, confirmText: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      toast.exito('Usuario eliminado');
      cargar(1);
    } catch (e) {
      toast.error(e.message);
    }
  }

  const renderItem = ({ item: u }) => (
    <Card style={styles.fila}>
      <View style={{ gap: space(1) }}>
        <View style={styles.filaTop}>
          <Text style={styles.nombre} numberOfLines={1}>{u.nombre}</Text>
          <Text style={styles.id}>#{u.id}</Text>
        </View>
        <Text style={styles.correo} numberOfLines={1}>{u.correo}</Text>
        <View style={styles.badges}>
          <Badge value={u.rol} label={u.rol === 'admin' ? 'Admin' : 'Usuario'} />
          <Badge value={u.estado} label={u.estado.charAt(0).toUpperCase() + u.estado.slice(1)} />
          <Text style={styles.meta}>{u.intentos_finalizados} simulaciones · desde {formatoFecha(u.fecha_registro)}</Text>
        </View>
      </View>
      <View style={styles.acciones}>
        <Button small title="Ver / Editar" variant="secondary" onPress={() => router.push(`/admin/usuarios/${u.id}`)} style={{ flex: 1 }} />
        {u.estado !== 'eliminado' && u.id !== yo.id ? (
          <Button small title="Eliminar" variant="danger" onPress={() => eliminar(u)} style={{ flex: 1 }} />
        ) : null}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <FlatList
        data={datos}
        keyExtractor={(u) => String(u.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space(3), marginBottom: space(1) }}>
            <Button title="Nuevo usuario" icon="person-add-outline" onPress={() => router.push('/admin/usuarios/nuevo')} />
            <TextField placeholder="Buscar por nombre o correo" value={buscar} onChangeText={setBuscar} autoCapitalize="none" />
            <Segmented options={FILTROS} value={estado} onChange={setEstado} />
            <FormError message={error} />
            <Text style={styles.meta}>{meta.total} usuario(s)</Text>
          </View>
        }
        ListEmptyComponent={!cargando ? <EmptyState title="Sin resultados" message="No hay usuarios con estos criterios." /> : null}
        ListFooterComponent={
          cargando ? <ActivityIndicator color={colors.primary} style={{ margin: space(4) }} />
            : meta.pagina < meta.paginas ? <Button title="Cargar más" variant="ghost" onPress={() => cargar(meta.pagina + 1)} /> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lista: { padding: space(5), gap: space(3), width: '100%', maxWidth: 720, alignSelf: 'center' },
  fila: { gap: space(3) },
  filaTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space(2) },
  nombre: { ...type.h3, flex: 1 },
  id: type.small,
  correo: type.small,
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), marginTop: space(1) },
  meta: type.caption,
  acciones: { flexDirection: 'row', gap: space(2) },
});
