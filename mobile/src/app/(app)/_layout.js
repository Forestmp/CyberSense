import { Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';

export default function AppLayout() {
  const { esAdmin } = useAuth();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Inicio', headerShown: false }} />
      <Stack.Screen name="simulacion" options={{ title: 'Simulación' }} />
      <Stack.Screen name="progreso" options={{ title: 'Mi progreso' }} />
      <Stack.Screen name="historial" options={{ title: 'Historial' }} />
      <Stack.Screen name="perfil" options={{ title: 'Mi perfil' }} />
      <Stack.Protected guard={esAdmin}>
        <Stack.Screen name="admin/usuarios/index" options={{ title: 'Usuarios' }} />
        <Stack.Screen name="admin/usuarios/[id]" options={{ title: 'Usuario' }} />
      </Stack.Protected>
    </Stack>
  );
}
