import { useState } from 'react';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { AuthLayout } from '../components/AuthLayout';
import { Button, FormError, Input } from '../components/ui';
import { PasswordRules } from '../components/PasswordRules';
import { correoValido, passwordValida } from '../lib/validacion';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, space, type } from '../theme';

function validar({ nombre, correo, password, confirmar_password }) {
  const e = {};
  if (nombre.trim().length < 2) e.nombre = 'Escribe tu nombre (mínimo 2 caracteres)';
  if (!correoValido(correo)) e.correo = 'Escribe un correo válido, por ejemplo nombre@dominio.com';
  if (!passwordValida(password)) e.password = 'La contraseña no cumple los requisitos';
  if (!confirmar_password) e.confirmar_password = 'Confirma tu contraseña';
  else if (confirmar_password !== password) e.confirmar_password = 'Las contraseñas no coinciden';
  return e;
}

export default function Registro() {
  const { registrarse } = useAuth();
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', confirmar_password: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const set = (campo) => (valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

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
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Aprende a reconocer engaños por correo, SMS y suplantación de identidad."
      footer={(
        <Text style={[type.body, { textAlign: 'center', color: colors.textMuted }]}>
          ¿Ya tienes una cuenta?{' '}
          <Link href="/login" style={{ color: colors.primary, fontFamily: fonts.semibold }}>Inicia sesión</Link>
        </Text>
      )}
    >
      <FormError message={error} />
      <Input label="Nombre" icon="person-outline" value={form.nombre} onChangeText={set('nombre')} error={errores.nombre}
        autoComplete="name" placeholder="Tu nombre" valid={form.nombre.trim().length >= 2} />
      <Input label="Correo electrónico" icon="mail-outline" value={form.correo} onChangeText={set('correo')} error={errores.correo}
        autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email"
        placeholder="tucorreo@ejemplo.com" valid={correoValido(form.correo)} />
      <Input label="Contraseña" icon="lock-closed-outline" value={form.password} onChangeText={set('password')} error={errores.password}
        secure autoComplete="new-password" placeholder="Crea una contraseña" />
      <PasswordRules password={form.password} />
      <Input label="Confirmar contraseña" icon="lock-closed-outline" value={form.confirmar_password} onChangeText={set('confirmar_password')}
        error={errores.confirmar_password} secure autoComplete="new-password" placeholder="Repite tu contraseña"
        valid={!!form.confirmar_password && form.confirmar_password === form.password} onSubmitEditing={enviar} />
      <Button title="Crear cuenta" size="lg" onPress={enviar} loading={enviando} />
    </AuthLayout>
  );
}
