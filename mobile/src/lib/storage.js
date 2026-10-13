import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore (cifrado del sistema) en Android/iOS; en web no existe y se usa
// localStorage, suficiente para las demostraciones en navegador.
const web = Platform.OS === 'web';

export const storage = {
  async get(key) {
    if (web) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key, value) {
    if (web) {
      try { window.localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key) {
    if (web) {
      try { window.localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
