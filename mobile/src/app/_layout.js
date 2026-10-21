import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { Loading } from '../components/ui';
import { colors } from '../theme';

function Navegacion() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Loading />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Sin sesión: bienvenida es la primera pantalla */}
      <Stack.Protected guard={!usuario}>
        <Stack.Screen name="bienvenida" />
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="recuperar" />
      </Stack.Protected>
      <Stack.Protected guard={!!usuario}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fuentesListas, errorFuentes] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });
  // Si las fuentes fallan se continúa con la tipografía del sistema.
  if (!fuentesListas && !errorFuentes) return null;

  return (
    <SafeAreaProvider>
      <FeedbackProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Navegacion />
        </AuthProvider>
      </FeedbackProvider>
    </SafeAreaProvider>
  );
}
