import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * URL de la API. Prioridad:
 *  1. EXPO_PUBLIC_API_URL (archivo mobile/.env)
 *  2. En desarrollo, la IP de la computadora que sirve Expo (para que el
 *     celular con Expo Go llegue a la API en la misma red) con puerto 3000.
 *  3. http://localhost:3000
 */
function resolverApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  // Web: mismo host desde el que se abrió la página (localhost en la PC, la IP de la PC desde el navegador del celular).
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:3000`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;
  return 'http://localhost:3000';
}

export const API_URL = resolverApiUrl();

export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Convierte details [{campo:'body.correo', mensaje}] en { correo: mensaje }. */
  get camposConError() {
    const out = {};
    for (const d of Array.isArray(this.details) ? this.details : []) {
      const campo = d.campo?.split('.').slice(1).join('.') || d.campo;
      if (campo && !out[campo]) out[campo] = d.mensaje;
    }
    return out;
  }
}

let token = null;
let onUnauthorized = null;

export const setAuthToken = (t) => { token = t; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString()
    : '';
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}${qs}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API_URL}). Verifica que la API esté en ejecución.`, 'NETWORK');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, e.message || `Error ${res.status}`, e.code, e.details);
  }
  return data;
}
