import { Tabs } from 'expo-router';
import { BottomNav } from '../../../components/BottomNav';
import { colors, fonts } from '../../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.navy, fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', headerShown: false, tabBarIconNames: ['home', 'home-outline'] }} />
      <Tabs.Screen name="simulaciones" options={{ title: 'Simular', headerTitle: 'Simulaciones', tabBarIconNames: ['shield-checkmark', 'shield-checkmark-outline'] }} />
      <Tabs.Screen name="progreso" options={{ title: 'Progreso', headerTitle: 'Mi progreso', tabBarIconNames: ['stats-chart', 'stats-chart-outline'] }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial', tabBarIconNames: ['time', 'time-outline'] }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', headerTitle: 'Mi perfil', tabBarIconNames: ['person-circle', 'person-circle-outline'] }} />
    </Tabs>
  );
}
