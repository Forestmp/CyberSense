import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../../api/client';
import { Badge, Button, Card, FormError, Loading, Screen, Segmented, TextField } from '../../../../components/ui';
import { useAuth } from '../../../../context/AuthContext';
import { avisar, confirmar } from '../../../../lib/confirm';
import { colors, space } from '../../../../theme';

const ROLES = [{ value: 'usuario', label: 'Usuario' }, { value: 'admin', label: 'Administrador' }];
const ESTADOS = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'bloqueado', label: 'Bloqueado' },
];

const formatoFecha = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Crear (id = "nuevo") o ver/editar un usuario. */
export default function UsuarioForm() {
  const { id } = useLocalSearchParams();
  const esNuevo = id === 'nuevo';
  const router = useRouter();
  const { usuario: yo, actualizarUsuario } = useAuth();
  const esPropio = !esNuevo && Number(id) === yo.id;

  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState({ nombre: '', correo: '', rol: 'usuario', estado: 'activo', password: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(!esNuevo);
  const [guardando, setGuardando] = useState(false);
  const set = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));

  useEffect(() => {
    if (esNuevo) return;
    api(`/users/${id}`)
      .then(({ usuario: u }) => {
        setOriginal(u);
        setForm({ nombre: u.nombre, correo: u.correo, rol: u.rol, estado: u.estado === 'eliminado' ? 'activo' : u.estado, password: '' });
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [id, esNuevo]);

  function cuerpo() {
    if (esNuevo) {
      return { nombre: form.nombre.trim(), correo: form.correo.trim(), rol: form.rol, estado: form.estado, password: form.password };
    }
    const b = {};
    if (form.nombre.trim() !== original.nombre) b.nombre = form.nombre.trim();
    if (form.correo.trim().toLowerCase() !== original.correo) b.correo = form.correo.trim();
    if (!esPropio && form.rol !== original.rol) b.rol = form.rol;
    if (!esPropio && form.estado !== original.estado) b.estado = form.estado;
    if (form.password) b.password_nueva = form.password;
    return b;
  }

  async function guardar() {
    setError('');
    setErrores({});
    const body = cuerpo();
    if (!esNuevo && !Object.keys(body).length) {
      setError('No hay cambios por guardar.');
      return;
    }
    if (esPropio && body.password_nueva) {
      setError('Para cambiar tu propia contraseña usa «Mi perfil».');
      return;
    }
    setGuardando(true);
    try {
      if (esNuevo) {
        await api('/users', { method: 'POST', body });
        avisar('Usuario creado', `${body.nombre} ya puede iniciar sesión.`);
      } else {
        const { usuario: u } = await api(`/users/${id}`, { method: 'PUT', body });
        if (esPropio) actualizarUsuario({ ...yo, ...u });
        avisar('Cambios guardados', original.estado === 'eliminado' ? 'El usuario fue restaurado.' : 'El usuario se actualizó.');
      }
      router.back();
    } catch (e) {
      const campos = e.camposConError || {};
      if (campos.password_nueva) campos.password = campos.password_nueva;
      setErrores(campos);
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    const ok = await confirmar('Eliminar usuario', `¿Eliminar a ${original.nombre}? Su historial se conserva.`, 'Eliminar');
    if (!ok) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      setError(e.message);
    }
  }

  if (cargando) return <Loading />;
  if (!esNuevo && !original) return <Screen><FormError message={error || 'Usuario no encontrado'} /></Screen>;

  const eliminado = original?.estado === 'eliminado';

  return (
    <Screen>
      <Stack.Screen options={{ title: esNuevo ? 'Nuevo usuario' : 'Editar usuario' }} />

      {!esNuevo ? (
        <Card style={{ gap: space(1.5) }}>
          <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted }}>ID #{original.id}</Text>
            <Badge value={original.estado} label={original.estado} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Registro: {formatoFecha(original.fecha_registro)}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Última actualización: {formatoFecha(original.fecha_actualizacion)}</Text>
          {eliminado ? (
            <Text style={{ color: colors.warning, fontSize: 13 }}>
              Eliminado el {formatoFecha(original.fecha_eliminacion)}. Elige un estado y guarda para restaurarlo.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <FormError message={error} />
      <TextField label="Nombre" value={form.nombre} onChangeText={set('nombre')} error={errores.nombre} />
      <TextField
        label="Correo electrónico" value={form.correo} onChangeText={set('correo')} error={errores.correo}
        autoCapitalize="none" keyboardType="email-address" inputMode="email"
      />
      {esPropio ? (
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>No puedes cambiar tu propio rol ni estado.</Text>
      ) : (
        <>
          <Segmented label="Rol" options={ROLES} value={form.rol} onChange={set('rol')} />
          <Segmented label={eliminado ? 'Estado al restaurar' : 'Estado'} options={ESTADOS} value={form.estado} onChange={set('estado')} />
        </>
      )}
      {!esPropio ? (
        <TextField
          label={esNuevo ? 'Contraseña' : 'Nueva contraseña (opcional)'}
          value={form.password} onChangeText={set('password')} error={errores.password} secure autoComplete="new-password"
          hint={esNuevo ? 'Mínimo 8 caracteres, con letras y números' : 'Déjala vacía para no cambiarla'}
        />
      ) : null}

      <Button title={esNuevo ? 'Crear usuario' : eliminado ? 'Restaurar usuario' : 'Guardar cambios'} onPress={guardar} loading={guardando} />
      {!esNuevo && !eliminado && !esPropio ? <Button title="Eliminar usuario" variant="danger" onPress={eliminar} /> : null}
    </Screen>
  );
}
