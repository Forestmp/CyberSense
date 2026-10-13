import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, FormError, Screen, Subtitle, TextField, Title } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, space } from '../theme';
import { Marca } from '../components/Marca';

function validar({ nombre, correo, password, confirmar_password }) {
  const e = {};
  if (nombre.trim().length < 2) e.nombre = 'Escribe tu nombre';
  if (!/^\S+@\S+\.\S+$/.test(correo.trim())) e.correo = 'Escribe un correo válido';
  if (password.length < 8) e.password = 'Mínimo 8 caracteres';
  else if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password) || !/\d/.test(password)) e.password = 'Debe incluir letras y números';
  if (confirmar_password !== password) e.confirmar_password = 'Las contraseñas no coinciden';
  return e;
}

export default function Registro() {
  const { registrarse } = useAuth();
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', confirmar_password: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));

  async function enviar() {
    setError('');
    const locales = validar(form);
    setErrores(locales);
    if (Object.keys(locales).length) return;
    setEnviando(true);
    try {
      await registrarse({ ...form, nombre: form.nombre.trim(), correo: form.correo.trim() });
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
          <Title>Crear cuenta</Title>
          <Subtitle>Aprende a reconocer engaños por correo, SMS y suplantación de identidad.</Subtitle>
        </View>
        <FormError message={error} />
        <TextField label="Nombre" value={form.nombre} onChangeText={set('nombre')} error={errores.nombre} autoComplete="name" />
        <TextField
          label="Correo electrónico" value={form.correo} onChangeText={set('correo')} error={errores.correo}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email"
        />
        <TextField
          label="Contraseña" value={form.password} onChangeText={set('password')} error={errores.password}
          secure autoComplete="new-password" hint="Mínimo 8 caracteres, con letras y números"
        />
        <TextField
          label="Confirmar contraseña" value={form.confirmar_password} onChangeText={set('confirmar_password')}
          error={errores.confirmar_password} secure autoComplete="new-password" onSubmitEditing={enviar}
        />
        <Button title="Crear cuenta" onPress={enviar} loading={enviando} />
        <Text style={{ textAlign: 'center', color: colors.textMuted }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" style={{ color: colors.primary, fontWeight: '600' }}>Inicia sesión</Link>
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
