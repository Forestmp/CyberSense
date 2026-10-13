import { Badge } from './ui';
import { ESTADOS_ESCENARIO } from '../lib/etiquetas';

const TONO = { activo: 'success', borrador: 'info', inactivo: 'warning', eliminado: 'neutral' };

/** Estado de un escenario con ícono y texto. */
export function EstadoBadge({ estado }) {
  const e = ESTADOS_ESCENARIO[estado] || ESTADOS_ESCENARIO.borrador;
  return <Badge tone={TONO[estado] || 'info'} icon={e.icon} label={e.label} />;
}
