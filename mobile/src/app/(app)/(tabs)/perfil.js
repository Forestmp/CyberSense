import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { Badge, Button, Card, FormError, Input, Ionicons, Modal, Screen, SectionTitle } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useFeedback } from '../../../context/FeedbackContext';
import { fecha } from '../../../lib/etiquetas';
import { colors, fonts, radius, space, type } from '../../../theme';

function Dato({ icon, etiqueta, valor }) {
  return (
    <View style={styles.dato}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={type.caption}>{etiqueta}</Text>
        <Text style={type.bodyStrong}>{valor}</Text>
      </View>
    </View>
  );
}

function Opcion({ icon, titulo, onPress, color = colors.text }) {
  return (
    <Card onPress={onPress} style={styles.opcion} accessibilityLabel={titulo}>
      <Ionicons name={icon} size={20} color={color === colors.text ? colors.primary : color} />
      <Text style={[type.bodyStrong, { flex: 1, color }]}>{titulo}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Card>
  );
}

export default function Perfil() {
  const router = useRouter();
  const { usuario, esAdmin, actualizarUsuario, cerrarSesion, renovarToken } = useAuth();
  const { toast, confirm } = useFeedback();
  const [modal, setModal] = useState(null); // 'datos' | 'password'
  const [datos, setDatos] = useState({ nombre: '', correo: '' });
  const [pwd, setPwd] = useState({ password_actual: '', password_nueva: '', confirmar: '' });
  const [errores, setErrores] = useState({ campos: {}, msg: '' });
  const [guardando, setGuardando] = useState(false);

  const abrir = (tipo) => {
    setErrores({ campos: {}, msg: '' });
    if (tipo === 'datos') setDatos({ nombre: usuario.nombre, correo: usuario.correo });
    if (tipo === 'password') setPwd({ password_actual: '', password_nueva: '', confirmar: '' });
    setModal(tipo);
  };

  async function guardarDatos() {
    const body = {};
    if (datos.nombre.trim() !== usuario.nombre) body.nombre = datos.nombre.trim();
    if (datos.correo.trim().toLowerCase() !== usuario.correo) body.correo = datos.correo.trim();
    if (!Object.keys(body).length) { setModal(null); return; }
    setGuardando(true);
    try {
      const { usuario: u } = await api(`/users/${usuario.id}`, { method: 'PUT', body });
      actualizarUsuario(u);
      setModal(null);
      toast.exito('Perfil actualizado correctamente');
    } catch (e) {
      setErrores({ campos: e.camposConError, msg: e.message });
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarPassword() {
    if (pwd.password_nueva !== pwd.confirmar) {
      setErrores({ campos: { confirmar: 'Las contraseñas no coinciden' }, msg: '' });
      return;
    }
    setGuardando(true);
    try {
      const r = await api(`/users/${usuario.id}`, { method: 'PUT', body: { password_actual: pwd.password_actual, password_nueva: pwd.password_nueva } });
      if (r.token) await renovarToken(r.token);
      setModal(null);
      toast.exito('Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.');
    } catch (e) {
      setErrores({ campos: e.camposConError, msg: e.message });
    } finally {
      setGuardando(false);
    }
  }

  async function salir() {
    if (await confirm({ title: 'Cerrar sesión', message: '¿Quieres salir de CyberSense en este dispositivo?', confirmText: 'Cerrar sesión' })) {
      cerrarSesion();
    }
  }

  const iniciales = usuario.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: space(2), paddingVertical: space(6) }}>
        <View style={styles.avatar}><Text style={styles.avatarTexto}>{iniciales}</Text></View>
        <Text style={type.h1}>{usuario.nombre}</Text>
        <Badge tone={esAdmin ? 'info' : 'neutral'} icon={esAdmin ? 'key-outline' : 'person-outline'} label={esAdmin ? 'Administrador' : 'Usuario'} />
      </Card>

      <Card style={{ gap: space(1) }}>
        <Dato icon="person-outline" etiqueta="Nombre" valor={usuario.nombre} />
        <Dato icon="mail-outline" etiqueta="Correo electrónico" valor={usuario.correo} />
        <Dato icon="calendar-outline" etiqueta="Fecha de registro" valor={fecha(usuario.fecha_registro)} />
      </Card>

      <SectionTitle>Cuenta</SectionTitle>
      <Opcion icon="create-outline" titulo="Editar perfil" onPress={() => abrir('datos')} />
      <Opcion icon="lock-closed-outline" titulo="Cambiar contraseña" onPress={() => abrir('password')} />
      <Opcion icon="book-outline" titulo="Aprender" onPress={() => router.push('/aprender')} />

      {esAdmin ? (
        <>
          <SectionTitle>Administración</SectionTitle>
          <Opcion icon="layers-outline" titulo="Administrar escenarios" onPress={() => router.push('/admin/escenarios')} />
          <Opcion icon="people-outline" titulo="Administrar usuarios" onPress={() => router.push('/admin/usuarios')} />
        </>
      ) : null}

      <Button title="Cerrar sesión" icon="log-out-outline" variant="danger" onPress={salir} style={{ marginTop: space(2) }} />

      <Modal visible={modal === 'datos'} onClose={() => setModal(null)} title="Editar perfil" icon="create-outline"
        actions={[
          <Button key="g" title="Guardar cambios" onPress={guardarDatos} loading={guardando} />,
          <Button key="c" title="Cancelar" variant="ghost" onPress={() => setModal(null)} />,
        ]}>
        <View style={{ alignSelf: 'stretch', gap: space(3) }}>
          <FormError message={errores.msg} />
          <Input label="Nombre" icon="person-outline" value={datos.nombre} error={errores.campos.nombre}
            onChangeText={(v) => setDatos((d) => ({ ...d, nombre: v }))} />
          <Input label="Correo electrónico" icon="mail-outline" value={datos.correo} error={errores.campos.correo}
            autoCapitalize="none" keyboardType="email-address" inputMode="email"
            onChangeText={(v) => setDatos((d) => ({ ...d, correo: v }))} />
        </View>
      </Modal>

      <Modal visible={modal === 'password'} onClose={() => setModal(null)} title="Cambiar contraseña" icon="lock-closed-outline"
        actions={[
          <Button key="g" title="Actualizar contraseña" onPress={cambiarPassword} loading={guardando}
            disabled={!pwd.password_actual || !pwd.password_nueva || !pwd.confirmar} />,
          <Button key="c" title="Cancelar" variant="ghost" onPress={() => setModal(null)} />,
        ]}>
        <View style={{ alignSelf: 'stretch', gap: space(3) }}>
          <FormError message={errores.msg} />
          <Input label="Contraseña actual" secure value={pwd.password_actual} error={errores.campos.password_actual}
            autoComplete="current-password" onChangeText={(v) => setPwd((p) => ({ ...p, password_actual: v }))} />
          <Input label="Nueva contraseña" secure value={pwd.password_nueva} error={errores.campos.password_nueva}
            hint="Mínimo 8 caracteres, con letras y números" autoComplete="new-password"
            onChangeText={(v) => setPwd((p) => ({ ...p, password_nueva: v }))} />
          <Input label="Confirmar nueva contraseña" secure value={pwd.confirmar} error={errores.campos.confirmar}
            autoComplete="new-password" onChangeText={(v) => setPwd((p) => ({ ...p, confirmar: v }))} />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontFamily: fonts.bold, fontSize: 26, color: '#FFFFFF' },
  dato: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2) },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3.5), borderRadius: radius.md },
});
