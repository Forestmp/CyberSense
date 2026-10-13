import { Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts } from '../../theme';

export default function AppLayout() {
  const { esAdmin } = useAuth();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.navy, fontSize: 18 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="simulacion/[id]" options={{ title: 'Simulación' }} />
      <Stack.Screen name="resultado/[id]" options={{ title: 'Resultado' }} />
      <Stack.Screen name="retroalimentacion/[id]" options={{ title: 'Retroalimentación' }} />
      <Stack.Screen name="aprender" options={{ title: 'Aprender' }} />
      <Stack.Protected guard={esAdmin}>
        <Stack.Screen name="admin/escenarios/index" options={{ title: 'Administrar escenarios' }} />
        <Stack.Screen name="admin/escenarios/[id]" options={{ title: 'Escenario' }} />
        <Stack.Screen name="admin/escenarios/editor" options={{ title: 'Editor de escenario' }} />
        <Stack.Screen name="admin/usuarios/index" options={{ title: 'Administrar usuarios' }} />
        <Stack.Screen name="admin/usuarios/[id]" options={{ title: 'Usuario' }} />
      </Stack.Protected>
    </Stack>
  );
}
