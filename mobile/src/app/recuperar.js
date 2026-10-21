import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordRules } from '../components/PasswordRules';
import { Alert, Button, FormError, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { correoValido, passwordValida } from '../lib/validacion';
import { colors, fonts, space, type } from '../theme';

const ESPERA_REENVIO = 60;

/** Recuperar contraseña: 1) pedir código por correo, 2) código + contraseña nueva. */
export default function Recuperar() {
  const params = useLocalSearchParams();
  const { restablecerPassword } = useAuth();
  const { toast } = useFeedback();
  const [paso, setPaso] = useState('correo');
  const [correo, setCorreo] = useState(typeof params.correo === 'string' ? params.correo : '');
  const [form, setForm] = useState({ codigo: '', password: '', confirmar_password: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const codigoRef = useRef(null);

  // Cuenta regresiva para permitir reenviar el código.
  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function pedirCodigo() {
    setError('');
    if (!correoValido(correo)) {
      setErrores({ correo: 'Escribe un correo válido, por ejemplo nombre@dominio.com' });
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { correo: correo.trim() } });
      setPaso('codigo');
      setEspera(ESPERA_REENVIO);
      setTimeout(() => codigoRef.current?.focus(), 300);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { correo: correo.trim() } });
      setEspera(ESPERA_REENVIO);
      setForm((f) => ({ ...f, codigo: '' }));
      toast.info('Si el correo está registrado, te enviamos un código nuevo');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function cambiar() {
    setError('');
    const locales = {};
    if (!/^\d{6}$/.test(form.codigo.trim())) locales.codigo = 'El código tiene 6 dígitos';
    if (!passwordValida(form.password)) locales.password = 'La contraseña no cumple los requisitos';
    if (form.confirmar_password !== form.password) locales.confirmar_password = 'Las contraseñas no coinciden';
    setErrores(locales);
    if (Object.keys(locales).length) return;
    setEnviando(true);
    try {
      await restablecerPassword({
        correo: correo.trim(), codigo: form.codigo.trim(), password: form.password, confirmar_password: form.confirmar_password,
      });
      toast.exito('Contraseña actualizada. ¡Bienvenido de nuevo!');
    } catch (e) {
      setErrores(e.camposConError || {});
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const set = (campo) => (v) => {
    setForm((f) => ({ ...f, [campo]: campo === 'codigo' ? v.replace(/\D/g, '').slice(0, 6) : v }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  if (paso === 'correo') {
    return (
      <AuthLayout title="Recupera tu contraseña" subtitle="Escribe el correo de tu cuenta y te enviaremos un código de 6 dígitos.">
        <FormError message={error} />
        <Input
          label="Correo electrónico" icon="mail-outline" value={correo} onChangeText={setCorreo} error={errores.correo}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email"
          placeholder="tucorreo@ejemplo.com" returnKeyType="send" onSubmitEditing={pedirCodigo}
        />
        <Button title="Enviar código" size="lg" icon="paper-plane-outline" onPress={pedirCodigo} loading={enviando} />
        <Alert tone="info" message="CyberSense nunca te pedirá tu contraseña ni este código por correo, mensaje o llamada." />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Crea una contraseña nueva" subtitle={`Si ${correo.trim()} está registrado, recibirás un código. Revisa también tu carpeta de spam.`}>
      <FormError message={error} />
      <Input
        ref={codigoRef} label="Código de 6 dígitos" icon="keypad-outline" value={form.codigo} onChangeText={set('codigo')}
        error={errores.codigo} keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code"
        textContentType="oneTimeCode" maxLength={6} placeholder="000000" inputStyle={styles.codigo}
      />
      <Input label="Nueva contraseña" icon="lock-closed-outline" value={form.password} onChangeText={set('password')}
        error={errores.password} secure autoComplete="new-password" placeholder="Crea una contraseña" />
      <PasswordRules password={form.password} />
      <Input label="Confirmar contraseña" icon="lock-closed-outline" value={form.confirmar_password} onChangeText={set('confirmar_password')}
        error={errores.confirmar_password} secure autoComplete="new-password" placeholder="Repite tu contraseña"
        valid={!!form.confirmar_password && form.confirmar_password === form.password} onSubmitEditing={cambiar} />
      <Button title="Cambiar contraseña" size="lg" onPress={cambiar} loading={enviando} />

      <View style={styles.acciones}>
        {espera > 0 ? (
          <Text style={type.small}>Puedes pedir otro código en {espera} s</Text>
        ) : (
          <Pressable onPress={reenviar} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.enlace}>Reenviar código</Text>
          </Pressable>
        )}
        <Pressable onPress={() => { setPaso('correo'); setError(''); setErrores({}); }} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.enlace}>Usar otro correo</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  codigo: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: 6 },
  acciones: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
  enlace: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
});
