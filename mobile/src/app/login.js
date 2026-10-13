import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, FormError, Screen, Subtitle, TextField, Title } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Marca } from '../components/Marca';
import { colors, space } from '../theme';

export default function Login() {
  const { iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const passRef = useRef(null);

  async function enviar() {
    setError('');
    setErrores({});
    if (!correo.trim() || !password) {
      setErrores({ correo: !correo.trim() ? 'Escribe tu correo' : undefined, password: !password ? 'Escribe tu contraseña' : undefined });
      return;
    }
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={{ justifyContent: 'center' }}>
        <Marca />
        <View style={{ gap: space(1) }}>
          <Title>Iniciar sesión</Title>
          <Subtitle>Ingresa con tu cuenta para continuar tu entrenamiento.</Subtitle>
        </View>
        <FormError message={error} />
        <TextField
          label="Correo electrónico"
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
        <TextField
          ref={passRef}
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          error={errores.password}
          secure
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={enviar}
        />
        <Button title="Iniciar sesión" onPress={enviar} loading={enviando} />
        <Text style={{ textAlign: 'center', color: colors.textMuted }}>
          ¿No tienes cuenta?{' '}
          <Link href="/registro" style={{ color: colors.primary, fontWeight: '600' }}>Regístrate</Link>
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
