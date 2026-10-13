import { useRouter } from 'expo-router';
import { Button, EmptyState, Screen } from './ui';

/** Marcador para pantallas cuya API aún no está implementada. */
export function Proximamente({ titulo, descripcion }) {
  const router = useRouter();
  return (
    <Screen contentStyle={{ justifyContent: 'center' }}>
      <EmptyState title={titulo} message={descripcion}>
        <Button title="Volver al inicio" variant="secondary" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </EmptyState>
    </Screen>
  );
}
