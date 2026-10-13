import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/** Carga un intento (paso actual o resultado) con estado de error y reintento. */
export function useIntento(id) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    setError('');
    api(`/attempts/${id}`).then(setDatos).catch((e) => setError(e.message));
  }, [id]);
  useEffect(cargar, [cargar]);
  return { datos, error, cargar };
}
