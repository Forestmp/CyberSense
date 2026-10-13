import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, Logo } from './ui';
import { colors, radius, shadow, space, type } from '../theme';

/** Estructura común de login y registro: logo, título y tarjeta de formulario. */
export function AuthLayout({ title, subtitle, children, footer }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.fondo} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.contenido}>
            <View style={styles.top}>
              {router.canGoBack() ? (
                <IconButton icon="arrow-back" label="Volver" color={colors.navy} onPress={() => router.back()} style={{ marginLeft: -space(2) }} />
              ) : <View />}
            </View>
            <View style={styles.marca}>
              <Logo ancho={150} />
            </View>
            <View style={{ gap: space(1), alignItems: 'center' }}>
              <Text style={[type.h1, { textAlign: 'center' }]} accessibilityRole="header">{title}</Text>
              {subtitle ? <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{subtitle}</Text> : null}
            </View>
            <View style={[styles.tarjeta, shadow.md]}>{children}</View>
            {footer}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  contenido: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center', padding: space(5), gap: space(5), justifyContent: 'center' },
  top: { minHeight: 36, justifyContent: 'center' },
  marca: { alignItems: 'center' },
  tarjeta: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space(5), gap: space(4), borderWidth: 1, borderColor: colors.border },
});
