import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api/client';
import { Badge, Button, Card, FormError, Screen, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { avisar } from '../../lib/confirm';
import { colors, space } from '../../theme';

export default function Perfil() {
  const { usuario, actualizarUsuario, cerrarSesion } = useAuth();
  const [datos, setDatos] = useState({ nombre: usuario.nombre, correo: usuario.correo });
  const [pwd, setPwd] = useState({ password_actual: '', password_nueva: '', confirmar: '' });
  const [errDatos, setErrDatos] = useState({ campos: {}, msg: '' });
  const [errPwd, setErrPwd] = useState({ campos: {}, msg: '' });
  const [guardando, setGuardando] = useState(null);

  const cambiosDatos = {};
  if (datos.nombre.trim() !== usuario.nombre) cambiosDatos.nombre = datos.nombre.trim();
  if (datos.correo.trim().toLowerCase() !== usuario.correo) cambiosDatos.correo = datos.correo.trim();

  async function guardarDatos() {
    setErrDatos({ campos: {}, msg: '' });
    setGuardando('datos');
    try {
      const { usuario: u } = await api(`/users/${usuario.id}`, { method: 'PUT', body: cambiosDatos });
      actualizarUsuario(u);
      avisar('Listo', 'Tus datos se actualizaron.');
    } catch (e) {
      setErrDatos({ campos: e.camposConError, msg: e.message });
    } finally {
      setGuardando(null);
    }
  }

  async function cambiarPassword() {
    setErrPwd({ campos: {}, msg: '' });
    if (pwd.password_nueva !== pwd.confirmar) {
      setErrPwd({ campos: { confirmar: 'Las contraseñas no coinciden' }, msg: '' });
      return;
    }
    setGuardando('pwd');
    try {
      await api(`/users/${usuario.id}`, {
        method: 'PUT',
        body: { password_actual: pwd.password_actual, password_nueva: pwd.password_nueva },
      });
      setPwd({ password_actual: '', password_nueva: '', confirmar: '' });
      avisar('Listo', 'Tu contraseña se cambió correctamente.');
    } catch (e) {
      setErrPwd({ campos: e.camposConError, msg: e.message });
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Screen>
      <Card style={{ gap: space(2) }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{usuario.nombre}</Text>
        <Text style={{ color: colors.textMuted }}>{usuario.correo}</Text>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <Badge value={usuario.rol} label={usuario.rol === 'admin' ? 'Administrador' : 'Usuario'} />
        </View>
      </Card>

      <Card style={{ gap: space(4) }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>Datos de la cuenta</Text>
        <FormError message={errDatos.msg} />
        <TextField label="Nombre" value={datos.nombre} onChangeText={(v) => setDatos((d) => ({ ...d, nombre: v }))} error={errDatos.campos.nombre} />
        <TextField
          label="Correo electrónico" value={datos.correo} onChangeText={(v) => setDatos((d) => ({ ...d, correo: v }))}
          error={errDatos.campos.correo} autoCapitalize="none" keyboardType="email-address" inputMode="email"
        />
        <Button title="Guardar cambios" onPress={guardarDatos} loading={guardando === 'datos'} disabled={!Object.keys(cambiosDatos).length} />
      </Card>

      <Card style={{ gap: space(4) }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>Cambiar contraseña</Text>
        <FormError message={errPwd.msg} />
        <TextField label="Contraseña actual" value={pwd.password_actual} secure autoComplete="current-password"
          onChangeText={(v) => setPwd((p) => ({ ...p, password_actual: v }))} error={errPwd.campos.password_actual} />
        <TextField label="Nueva contraseña" value={pwd.password_nueva} secure autoComplete="new-password"
          hint="Mínimo 8 caracteres, con letras y números"
          onChangeText={(v) => setPwd((p) => ({ ...p, password_nueva: v }))} error={errPwd.campos.password_nueva} />
        <TextField label="Confirmar nueva contraseña" value={pwd.confirmar} secure autoComplete="new-password"
          onChangeText={(v) => setPwd((p) => ({ ...p, confirmar: v }))} error={errPwd.campos.confirmar} />
        <Button title="Cambiar contraseña" variant="secondary" onPress={cambiarPassword} loading={guardando === 'pwd'}
          disabled={!pwd.password_actual || !pwd.password_nueva} />
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={cerrarSesion} />
    </Screen>
  );
}
