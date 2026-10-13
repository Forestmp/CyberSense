import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { storage } from '../lib/storage';

const TOKEN_KEY = 'tt_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cerrarSesion = useCallback(async () => {
    setAuthToken(null);
    setUsuario(null);
    await storage.remove(TOKEN_KEY);
  }, []);

  const abrirSesion = useCallback(async ({ token, usuario: u }) => {
    setAuthToken(token);
    await storage.set(TOKEN_KEY, token);
    setUsuario(u);
  }, []);

  // Restaura la sesión guardada al abrir la app.
  useEffect(() => {
    setUnauthorizedHandler(() => { cerrarSesion(); });
    (async () => {
      try {
        const token = await storage.get(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const { usuario: u } = await api('/auth/me');
          setUsuario(u);
        }
      } catch {
        await cerrarSesion();
      } finally {
        setCargando(false);
      }
    })();
  }, [cerrarSesion]);

  const value = useMemo(() => ({
    usuario,
    cargando,
    esAdmin: usuario?.rol === 'admin',
    iniciarSesion: async (correo, password) => abrirSesion(await api('/auth/login', { method: 'POST', body: { correo, password } })),
    registrarse: async (datos) => abrirSesion(await api('/auth/register', { method: 'POST', body: datos })),
    cerrarSesion,
    actualizarUsuario: setUsuario,
  }), [usuario, cargando, abrirSesion, cerrarSesion]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
