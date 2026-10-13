import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../../api/client';
import { EstadoBadge } from '../../../../components/EstadoBadge';
import { Dificultad } from '../../../../components/ScenarioCard';
import { Button, Card, EmptyState, ErrorState, IconButton, Input, Loading, Segmented } from '../../../../components/ui';
import { useFeedback } from '../../../../context/FeedbackContext';
import { tipoInfo } from '../../../../lib/etiquetas';
import { BREAKPOINT_ANCHO, colors, fonts, radius, space, type } from '../../../../theme';

const FILTROS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'borrador', label: 'Borradores' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'eliminado', label: 'Eliminados' },
];

export default function AdminEscenarios() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tabla = width >= BREAKPOINT_ANCHO;
  const { toast, confirm } = useFeedback();
  const [buscar, setBuscar] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const r = await api('/scenarios', { query: { limite: 100, buscar: busqueda, estado } });
      setDatos(r.datos);
    } catch (e) {
      setError(e.message);
    }
  }, [busqueda, estado]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(buscar.trim()), 350);
    return () => clearTimeout(t);
  }, [buscar]);

  const ver = (e) => router.push(`/admin/escenarios/${e.id}`);
  const editar = (e) => router.push({ pathname: '/admin/escenarios/editor', params: { id: e.id } });

  async function alternarEstado(e) {
    const nuevo = e.estado === 'activo' ? 'inactivo' : 'activo';
    if (nuevo === 'inactivo' && !(await confirm({
      title: 'Desactivar escenario', message: `«${e.titulo}» dejará de mostrarse a los usuarios. Podrás activarlo de nuevo.`, confirmText: 'Desactivar',
    }))) return;
    try {
      await api(`/scenarios/${e.id}`, { method: 'PATCH', body: { estado: nuevo } });
      toast.exito(nuevo === 'activo' ? 'Escenario activado' : 'Escenario desactivado');
      cargar();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function eliminar(e) {
    if (!(await confirm({
      title: 'Eliminar escenario', danger: true, confirmText: 'Eliminar',
      message: `¿Eliminar «${e.titulo}» (${e.codigo})? Dejará de mostrarse, pero el historial de los usuarios se conserva.`,
    }))) return;
    try {
      await api(`/scenarios/${e.id}`, { method: 'DELETE' });
      toast.exito('Escenario eliminado');
      cargar();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const acciones = (e) => (e.estado === 'eliminado' ? (
    <IconButton icon="eye-outline" label={`Ver ${e.titulo}`} color={colors.primary} onPress={() => ver(e)} />
  ) : (
    <View style={styles.acciones}>
      <IconButton icon="eye-outline" label={`Ver ${e.titulo}`} color={colors.primary} onPress={() => ver(e)} />
      <IconButton icon="create-outline" label={`Editar ${e.titulo}`} color={colors.primary} onPress={() => editar(e)} />
      <IconButton
        icon={e.estado === 'activo' ? 'pause-circle-outline' : 'play-circle-outline'}
        label={e.estado === 'activo' ? `Desactivar ${e.titulo}` : `Activar ${e.titulo}`}
        color={colors.warningText} onPress={() => alternarEstado(e)}
      />
      <IconButton icon="trash-outline" label={`Eliminar ${e.titulo}`} color={colors.danger} onPress={() => eliminar(e)} />
    </View>
  ));

  const FilaTabla = ({ item: e, index }) => (
    <View style={[styles.fila, styles.filaDatos, index % 2 === 1 && { backgroundColor: '#FBFCFE' }, index === datos.length - 1 && styles.filaUltima]}>
      <Text style={[styles.celda, styles.cId]}>{e.codigo}</Text>
      <Text style={[styles.celda, styles.cNombre, { fontFamily: fonts.semibold }]} numberOfLines={2}>{e.titulo}</Text>
      <Text style={[styles.celda, styles.cTipo]}>{e.tipo_nombre}</Text>
      <View style={[styles.cDif]}><Dificultad clave={e.dificultad} nombre={e.dificultad_nombre} /></View>
      <View style={styles.cEstado}><EstadoBadge estado={e.estado} /></View>
      <View style={styles.cAcciones}>{acciones(e)}</View>
    </View>
  );

  const TarjetaMovil = ({ item: e }) => (
    <Card style={{ gap: space(2.5) }}>
      <View style={styles.tarjetaTop}>
        <Text style={styles.codigo}>{e.codigo}</Text>
        <EstadoBadge estado={e.estado} />
      </View>
      <Text style={type.h3}>{e.titulo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Text style={type.small}>{tipoInfo(e.tipo).label}</Text>
        <Dificultad clave={e.dificultad} nombre={e.dificultad_nombre} />
      </View>
      <View style={styles.tarjetaAcciones}>{acciones(e)}</View>
    </Card>
  );

  const encabezado = (
    <View style={{ gap: space(3), marginBottom: space(2) }}>
      <View style={styles.barraSuperior}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Input icon="search" placeholder="Buscar por nombre o ID (PH-001)" value={buscar} onChangeText={setBuscar} autoCapitalize="none" accessibilityLabel="Buscar escenarios" />
        </View>
        <Button title="Nuevo escenario" icon="add" onPress={() => router.push('/admin/escenarios/editor')} />
      </View>
      <Segmented options={FILTROS} value={estado} onChange={setEstado} />
      {datos ? <Text style={type.small}>{datos.length} escenario(s)</Text> : null}
      {tabla && datos?.length ? (
        <View style={[styles.fila, styles.filaEncabezado]}>
          <Text style={[styles.cId, styles.th]}>ID</Text>
          <Text style={[styles.th, styles.cNombre]}>Nombre</Text>
          <Text style={[styles.th, styles.cTipo]}>Tipo</Text>
          <Text style={[styles.th, styles.cDif]}>Dificultad</Text>
          <Text style={[styles.th, styles.cEstado]}>Estado</Text>
          <Text style={[styles.th, styles.cAcciones, { textAlign: 'right' }]}>Acciones</Text>
        </View>
      ) : null}
    </View>
  );

  if (!datos && !error) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      {error && !datos ? <ErrorState message="No fue posible cargar los escenarios. Intenta nuevamente." onRetry={cargar} /> : (
        <FlatList
          key={tabla ? 'tabla' : 'tarjetas'}
          data={datos}
          keyExtractor={(e) => String(e.id)}
          renderItem={tabla ? FilaTabla : TarjetaMovil}
          contentContainerStyle={[styles.lista, { maxWidth: tabla ? 1100 : 560 }]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={encabezado}
          ListEmptyComponent={<EmptyState icon="layers-outline" title="Sin escenarios" message="No hay escenarios con estos criterios." />}
          ItemSeparatorComponent={tabla ? null : () => <View style={{ height: space(3) }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lista: { padding: space(5), width: '100%', alignSelf: 'center' },
  barraSuperior: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space(3) },
  // Tabla (tablet / escritorio)
  filaDatos: { borderLeftWidth: 1, borderRightWidth: 1 },
  filaUltima: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  fila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(4), paddingVertical: space(3), borderBottomWidth: 1, borderColor: colors.border, gap: space(3), backgroundColor: colors.surface },
  filaEncabezado: {
    backgroundColor: colors.primarySoft, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: -space(2),
  },
  th: { fontFamily: fonts.bold, fontSize: 12, color: colors.navy, textTransform: 'uppercase', letterSpacing: 0.5 },
  celda: { ...type.body },
  cId: { width: 80, fontFamily: fonts.bold, color: colors.primary, fontSize: 14 },
  cNombre: { flex: 1 },
  cTipo: { width: 170 },
  cDif: { width: 120 },
  cEstado: { width: 110 },
  cAcciones: { width: 176, alignItems: 'flex-end' },
  acciones: { flexDirection: 'row', gap: space(1) },
  // Tarjetas (móvil)
  tarjetaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codigo: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  tarjetaAcciones: { borderTopWidth: 1, borderColor: colors.border, paddingTop: space(2), alignItems: 'flex-end' },
});
