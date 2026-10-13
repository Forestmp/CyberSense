import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { Badge, Card, EmptyState, FormError, Loading, Screen, Segmented, Subtitle } from '../../../components/ui';
import { nivelInfo, puntos } from '../../../lib/etiquetas';
import { colors, radius, space } from '../../../theme';

export default function ListaEscenarios() {
  const router = useRouter();
  const [escenarios, setEscenarios] = useState(null);
  const [recomendacion, setRecomendacion] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [tipo, setTipo] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let activo = true;
    Promise.all([api('/scenarios', { query: { limite: 100 } }), api('/scenarios/recommended'), api('/catalogos')])
      .then(([lista, rec, cat]) => {
        if (!activo) return;
        setEscenarios(lista.datos);
        setRecomendacion(rec.recomendacion);
        setTipos(cat.tipos_ataque);
      })
      .catch((e) => activo && setError(e.message));
    return () => { activo = false; };
  }, []));

  if (!escenarios && !error) return <Loading />;

  const filtrados = (escenarios || []).filter((e) => !tipo || e.tipo === tipo);
  const recomendado = escenarios?.find((e) => e.id === recomendacion?.escenario?.id);

  return (
    <Screen>
      <Subtitle>Elige un escenario. Actúa como lo harías en la vida real: la retroalimentación aparece al terminar.</Subtitle>
      <FormError message={error} />

      {recomendado ? (
        <Card onPress={() => router.push(`/simulacion/${recomendado.id}`)} style={styles.recomendado} accessibilityLabel={`Recomendado: ${recomendado.titulo}`}>
          <Text style={styles.recEtiqueta}>RECOMENDADO PARA TI</Text>
          <Text style={styles.recTitulo}>{recomendado.titulo}</Text>
          <Text style={styles.recMotivo}>{recomendacion.motivo}</Text>
        </Card>
      ) : null}

      {tipos.length ? (
        <Segmented
          options={[{ value: '', label: 'Todos' }, ...tipos.map((t) => ({ value: t.clave, label: t.nombre }))]}
          value={tipo}
          onChange={setTipo}
        />
      ) : null}

      {filtrados.length === 0 ? (
        <EmptyState title="Sin escenarios" message="No hay escenarios disponibles para este tipo de ataque todavía." />
      ) : (
        filtrados.map((e) => {
          const nivel = nivelInfo(e.mi_ultimo_nivel);
          return (
            <Card key={e.id} onPress={() => router.push(`/simulacion/${e.id}`)} style={{ gap: space(2) }} accessibilityLabel={e.titulo}>
              <View style={styles.fila}>
                <Text style={styles.codigo}>{e.codigo}</Text>
                <View style={{ flexDirection: 'row', gap: space(1.5) }}>
                  <Badge value="usuario" label={e.tipo_nombre} />
                  <Badge value="usuario" label={e.dificultad_nombre} />
                </View>
              </View>
              <Text style={styles.titulo}>{e.titulo}</Text>
              <Text style={styles.descripcion}>{e.descripcion}</Text>
              <View style={styles.pie}>
                {e.mis_intentos ? (
                  <>
                    <Text style={styles.meta}>Mejor puntaje: {puntos(e.mi_mejor_puntaje)} · {e.mis_intentos} intento(s)</Text>
                    <View style={[styles.pill, { backgroundColor: nivel.bg }]}>
                      <Text style={{ color: nivel.fg, fontSize: 12, fontWeight: '600' }}>Vulnerabilidad {nivel.label.toLowerCase()}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.meta}>Sin intentos</Text>
                )}
                <Text style={styles.empezar}>{e.mis_intentos ? 'Repetir ›' : 'Comenzar ›'}</Text>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  recomendado: { backgroundColor: colors.primary, borderColor: colors.primary, gap: space(1) },
  recEtiqueta: { color: '#BFDBFE', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  recTitulo: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  recMotivo: { color: '#DBEAFE', fontSize: 14 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codigo: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  titulo: { fontSize: 17, fontWeight: '700', color: colors.text },
  descripcion: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  pie: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), marginTop: space(1) },
  meta: { fontSize: 12, color: colors.textMuted },
  pill: { borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: 2 },
  empezar: { marginLeft: 'auto', color: colors.primary, fontWeight: '700' },
});
