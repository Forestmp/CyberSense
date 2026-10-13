import { Alert, Platform } from 'react-native';

/** Diálogo de confirmación que funciona en web y en móvil. Resuelve true/false. */
export function confirmar(titulo, mensaje, textoAceptar = 'Aceptar') {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoAceptar, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function avisar(titulo, mensaje) {
  if (Platform.OS === 'web') window.alert(`${titulo}\n\n${mensaje}`);
  else Alert.alert(titulo, mensaje);
}
