import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../../api/client';
import { ContenidoSimulado } from '../../../../components/ContenidoSimulado';
import { Button, Card, FormError, Loading, Screen } from '../../../../components/ui';
import { avisar, confirmar } from '../../../../lib/confirm';
import { fechaHora, TIPOS_ACCION } from '../../../../lib/etiquetas';
import { colors, radius, space } from '../../../../theme';
import { EstadoBadge } from '../../../../components/EstadoBadge';

const DESCRIPCION_REGLA = {
  OPCION_SELECCIONADA: (p) => `Si elige «${p.opcion}»`,
  TIPO_ACCION_PRESENTE: (p) => `Si toma alguna decisión ${p.tipo_accion}`,
  CONTEO_TIPO_ACCION: (p) => `Si toma ${p.minimo} o más decisiones ${p.tipo_accion}`,
  SECUENCIA: (p) => `Si elige en orden: ${(p.opciones || []).join(' → ')}`,
};

/** Vista de solo lectura de un escenario con toda su estructura. */
export default function VerEscenario() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [e, setE] = useState(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    api(`/scenarios/${id}`).then(({ escenario }) => setE(escenario)).catch((err) => setError(err.message));
  }, [id]));

  async function cambiarEstado(estado) {
    try {
      const { escenario } = await api(`/scenarios/${id}`, { method: 'PATCH', body: { estado } });
      setE((prev) => ({ ...prev, estado: escenario.estado }));
    } catch (err) {
      avisar('No se pudo cambiar el estado', err.message);
    }
  }

  async function eliminar() {
    if (!(await confirmar('Eliminar escenario', `¿Eliminar «${e.titulo}»? El historial se conserva.`, 'Eliminar'))) return;
    try {
      await api(`/scenarios/${id}`, { method: 'DELETE' });
      router.back();
    } catch (err) {
      avisar('No se pudo eliminar', err.message);
    }
  }

  if (!e && !error) return <Loading />;
  if (!e) return <Screen><FormError message={error} /></Screen>;

  const tituloPaso = (clave) => e.pasos.find((p) => p.clave === clave)?.titulo || clave;
  const eliminado = e.estado === 'eliminado';

  return (
    <Screen>
      <Stack.Screen options={{ title: e.codigo }} />
      <Card style={{ gap: space(2) }}>
        <View style={styles.fila}>
          <Text style={styles.codigo}>{e.codigo}</Text>
          <EstadoBadge estado={e.estado} />
        </View>
        <Text style={styles.titulo}>{e.titulo}</Text>
        <Text style={styles.meta}>{e.tipo_nombre} · {e.dificultad_nombre} · {e.total_intentos} intento(s) registrados</Text>
        <Text style={styles.texto}>{e.descripcion}</Text>
        {e.contenido?.contexto ? <Text style={[styles.texto, { color: colors.textMuted }]}>Contexto: {e.contenido.contexto}</Text> : null}
        <Text style={styles.meta}>Actualizado: {fechaHora(e.fecha_actualizacion)}</Text>
      </Card>

      {!eliminado ? (
        <View style={styles.acciones}>
          <Button small title="Editar" onPress={() => router.push({ pathname: '/admin/escenarios/editor', params: { id } })} style={{ flex: 1 }} />
          {e.estado === 'activo'
            ? <Button small title="Desactivar" variant="secondary" onPress={() => cambiarEstado('inactivo')} style={{ flex: 1 }} />
            : <Button small title="Activar" variant="secondary" onPress={() => cambiarEstado('activo')} style={{ flex: 1 }} />}
          {e.estado === 'activo' ? <Button small title="Probar" variant="secondary" onPress={() => router.push(`/simulacion/${id}`)} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}

      <Text style={styles.seccion}>Señales de alerta ({e.senales.length})</Text>
      {e.senales.map((s) => (
        <Card key={s.clave} style={{ gap: 2 }}>
          <Text style={styles.negrita}>{s.descripcion}</Text>
          <Text style={styles.meta}>{s.clave}</Text>
          <Text style={styles.texto}>{s.explicacion}</Text>
        </Card>
      ))}

      <Text style={styles.seccion}>Pasos y opciones ({e.pasos.length})</Text>
      {e.pasos.map((p, i) => (
        <Card key={p.clave} style={{ gap: space(3) }}>
          <Text style={styles.meta}>Paso {i + 1} · {p.clave}{p.es_inicial ? ' · INICIAL' : ''}</Text>
          <Text style={styles.negrita}>{p.titulo}</Text>
          <ContenidoSimulado contenido={p.contenido} />
          <Text style={styles.texto}>{p.pregunta}</Text>
          {p.opciones.map((o) => {
            const t = TIPOS_ACCION[o.tipo_accion];
            return (
              <View key={o.clave} style={[styles.opcion, { borderColor: t.fg }]}>
                <View style={styles.fila}>
                  <Text style={[styles.negrita, { flex: 1 }]}>{o.texto}</Text>
                  <Text style={{ color: t.fg, fontWeight: '800' }}>{o.puntuacion > 0 ? '+' : ''}{o.puntuacion}</Text>
                </View>
                <Text style={styles.meta}>
                  {t.label} · {o.siguiente_paso ? `→ ${tituloPaso(o.siguiente_paso)}` : 'Termina el escenario'}
                  {o.senales.length ? ` · identifica: ${o.senales.join(', ')}` : ''}
                </Text>
                <Text style={styles.texto}>{o.retroalimentacion}</Text>
              </View>
            );
          })}
        </Card>
      ))}

      <Text style={styles.seccion}>Reglas de evaluación ({e.reglas.length})</Text>
      {e.reglas.length === 0 ? <Text style={styles.meta}>Sin reglas específicas.</Text> : null}
      {e.reglas.map((r) => (
        <Card key={r.id} style={{ gap: 2, opacity: r.activa ? 1 : 0.5 }}>
          <View style={styles.fila}>
            <Text style={[styles.negrita, { flex: 1 }]}>{r.descripcion}</Text>
            <Text style={{ fontWeight: '800', color: r.ajuste_puntuacion < 0 ? colors.danger : colors.success }}>
              {r.ajuste_puntuacion > 0 ? '+' : ''}{r.ajuste_puntuacion}
            </Text>
          </View>
          <Text style={styles.meta}>{DESCRIPCION_REGLA[r.tipo_regla]?.(r.parametros) || r.tipo_regla}</Text>
          {r.retroalimentacion ? <Text style={styles.texto}>{r.retroalimentacion}</Text> : null}
        </Card>
      ))}

      {e.retroalimentacion_general ? (
        <>
          <Text style={styles.seccion}>Retroalimentación general</Text>
          <Card><Text style={styles.texto}>{e.retroalimentacion_general}</Text></Card>
        </>
      ) : null}

      {!eliminado ? <Button title="Eliminar escenario" variant="danger" onPress={eliminar} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2) },
  codigo: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.text },
  seccion: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: space(2) },
  negrita: { fontSize: 15, fontWeight: '600', color: colors.text },
  texto: { fontSize: 14, color: colors.text, lineHeight: 20 },
  meta: { fontSize: 12, color: colors.textMuted },
  acciones: { flexDirection: 'row', gap: space(2) },
  opcion: { borderLeftWidth: 3, paddingLeft: space(3), gap: 3, borderRadius: radius.sm },
});
