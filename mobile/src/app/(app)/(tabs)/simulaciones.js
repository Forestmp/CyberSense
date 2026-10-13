import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { ScenarioCard } from '../../../components/ScenarioCard';
import { EmptyState, ErrorState, Loading, Screen, Segmented, Subtitle } from '../../../components/ui';
import { space } from '../../../theme';

export default function Simulaciones() {
  const router = useRouter();
  const [datos, setDatos] = useState(null);
  const [tipo, setTipo] = useState('');
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [lista, rec, cat] = await Promise.all([
        api('/scenarios', { query: { limite: 100 } }), api('/scenarios/recommended'), api('/catalogos'),
      ]);
      setDatos({ escenarios: lista.datos, recomendadoId: rec.recomendacion?.escenario?.id, tipos: cat.tipos_ataque });
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (!datos && !error) return <Loading />;
  if (!datos) return <ErrorState message="No fue posible cargar los escenarios. Intenta nuevamente." onRetry={cargar} />;

  const filtrados = datos.escenarios
    .filter((e) => !tipo || e.tipo === tipo)
    .sort((a, b) => (b.id === datos.recomendadoId) - (a.id === datos.recomendadoId));

  return (
    <Screen refreshControl={<RefreshControl refreshing={refrescando} onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />}>
      <Subtitle>Elige un escenario y actúa como lo harías en la vida real. La retroalimentación aparece al terminar.</Subtitle>
      <Segmented
        options={[{ value: '', label: 'Todos' }, ...datos.tipos.map((t) => ({ value: t.clave, label: t.nombre }))]}
        value={tipo}
        onChange={setTipo}
      />
      {filtrados.length === 0 ? (
        <EmptyState icon="layers-outline" title="Sin escenarios disponibles" message="Todavía no hay escenarios activos de este tipo de ataque." />
      ) : (
        <View style={{ gap: space(3) }}>
          {filtrados.map((e) => (
            <ScenarioCard key={e.id} escenario={e} recomendado={e.id === datos.recomendadoId} onPress={() => router.push(`/simulacion/${e.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
