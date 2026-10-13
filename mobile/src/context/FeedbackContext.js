/**
 * Retroalimentación de acciones: avisos breves (toast) y confirmaciones en
 * un modal propio, iguales en Android, iOS y web.
 *   const { toast, confirm } = useFeedback();
 *   toast.exito('Escenario guardado correctamente');
 *   if (await confirm({ title: 'Eliminar', message: '…', confirmText: 'Eliminar', danger: true })) …
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Ionicons, Modal } from '../components/ui';
import { colors, radius, shadow, space, type } from '../theme';

const FeedbackContext = createContext(null);

const ESTILO_TOAST = {
  exito: { icon: 'checkmark-circle', color: colors.success },
  error: { icon: 'alert-circle', color: colors.danger },
  info: { icon: 'information-circle', color: colors.primary },
};

export function FeedbackProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [aviso, setAviso] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const opacidad = useRef(new Animated.Value(0)).current;
  const temporizador = useRef(null);

  const mostrar = useCallback((tipo, mensaje) => {
    clearTimeout(temporizador.current);
    setAviso({ tipo, mensaje });
    Animated.timing(opacidad, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    temporizador.current = setTimeout(() => {
      Animated.timing(opacidad, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setAviso(null));
    }, tipo === 'error' ? 4500 : 2800);
  }, [opacidad]);

  const confirm = useCallback((opciones) => new Promise((resolve) => {
    setConfirmacion({ ...opciones, resolve });
  }), []);

  const cerrarConfirmacion = (valor) => {
    confirmacion?.resolve(valor);
    setConfirmacion(null);
  };

  const value = useMemo(() => ({
    toast: {
      exito: (m) => mostrar('exito', m),
      error: (m) => mostrar('error', m),
      info: (m) => mostrar('info', m),
    },
    confirm,
  }), [mostrar, confirm]);

  const estilo = aviso ? ESTILO_TOAST[aviso.tipo] : null;

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {aviso ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toastWrap, { top: insets.top + space(3), opacity: opacidad }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <View style={[styles.toast, shadow.lg, { borderLeftColor: estilo.color }]}>
            <Ionicons name={estilo.icon} size={22} color={estilo.color} />
            <Text style={[type.bodyStrong, { flex: 1 }]}>{aviso.mensaje}</Text>
          </View>
        </Animated.View>
      ) : null}

      <Modal
        visible={!!confirmacion}
        onClose={() => cerrarConfirmacion(false)}
        title={confirmacion?.title}
        message={confirmacion?.message}
        icon={confirmacion?.danger ? 'warning-outline' : 'help-circle-outline'}
        iconColor={confirmacion?.danger ? colors.danger : colors.primary}
        actions={[
          <Button key="ok" title={confirmacion?.confirmText || 'Aceptar'} variant={confirmacion?.danger ? 'dangerSolid' : 'primary'}
            onPress={() => cerrarConfirmacion(true)} />,
          <Button key="cancel" title="Cancelar" variant="ghost" onPress={() => cerrarConfirmacion(false)} />,
        ]}
      />
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: space(4), right: space(4), alignItems: 'center', zIndex: 1000 },
  toast: {
    width: '100%', maxWidth: 480, flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space(4), borderLeftWidth: 4,
  },
});
