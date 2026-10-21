import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthLayout } from '../components/AuthLayout';
import { Button, FormError, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, space, type } from '../theme';

export default function Login() {
  const { iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const passRef = useRef(null);

  async function enviar() {
    setError('');
    const locales = {};
    if (!correo.trim()) locales.correo = 'Escribe tu correo electrónico';
    if (!password) locales.password = 'Escribe tu contraseña';
    setErrores(locales);
    if (Object.keys(locales).length) return;
    setEnviando(true);
    try {
      await iniciarSesion(correo.trim(), password);
    } catch (e) {
      setErrores(e.camposConError || {});
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout
      title="Inicia sesión"
      subtitle="Continúa tu entrenamiento en seguridad digital."
      footer={(
        <Text style={[type.body, { textAlign: 'center', color: colors.textMuted }]}>
          ¿No tienes una cuenta?{' '}
          <Link href="/registro" style={{ color: colors.primary, fontFamily: fonts.semibold }}>Crea una</Link>
        </Text>
      )}
    >
      <FormError message={error} />
      <Input
        label="Correo electrónico"
        icon="mail-outline"
        value={correo}
        onChangeText={setCorreo}
        error={errores.correo}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        placeholder="tucorreo@ejemplo.com"
      />
      <Input
        ref={passRef}
        label="Contraseña"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        error={errores.password}
        secure
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={enviar}
        placeholder="Tu contraseña"
      />
      <View style={{ alignItems: 'flex-end', marginTop: -space(1) }}>
        <Pressable onPress={() => router.push({ pathname: '/recuperar', params: correo.trim() ? { correo: correo.trim() } : {} })} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 }}>¿Olvidaste tu contraseña?</Text>
        </Pressable>
      </View>
      <Button title="Iniciar sesión" size="lg" onPress={enviar} loading={enviando} />

    </AuthLayout>
  );
}
