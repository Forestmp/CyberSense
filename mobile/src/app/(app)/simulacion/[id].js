import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../api/client';
import { ContenidoSimulado } from '../../../components/ContenidoSimulado';
import { Badge, Button, Card, FormError, Loading } from '../../../components/ui';
import { colors, radius, space } from '../../../theme';

/**
 * Ejecución de un escenario: introducción → decisiones paso a paso → resultado.
 * No se muestra si una decisión fue correcta hasta terminar.
 */
export default function Simulacion() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const scrollRef = useRef(null);
  const [escenario, setEscenario] = useState(null);
  const [intento, setIntento] = useState(null);
  const [paso, setPaso] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/scenarios/${id}`).then(({ escenario: e }) => setEscenario(e)).catch((e) => setError(e.message));
  }, [id]);

  async function comenzar() {
    setError('');
    setEnviando(true);
    try {
      const r = await api('/attempts', { method: 'POST', body: { escenario_id: Number(id) } });
      setIntento(r.intento);
      setPaso(r.paso);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    if (!seleccion) return;
    setError('');
    setEnviando(true);
    try {
      const r = await api(`/attempts/${intento.id}/responses`, { method: 'POST', body: { opcion_id: seleccion } });
      setIntento(r.intento);
      setSeleccion(null);
      if (r.paso) {
        setPaso(r.paso);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        setFinalizando(true);
        await api(`/attempts/${intento.id}/finish`, { method: 'POST' });
        router.replace(`/resultado/${intento.id}`);
      }
    } catch (e) {
      setError(e.message);
      setFinalizando(false);
    } finally {
      setEnviando(false);
    }
  }

  if (!escenario && !error) return <Loading />;

  if (finalizando) {
    return (
      <View style={styles.centro}>
        <Loading />
        <Text style={styles.evaluando}>Evaluando tus decisiones…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Stack.Screen options={{ title: escenario?.codigo || 'Simulación' }} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.aviso}>
          <Text style={styles.avisoText}>SIMULACIÓN EDUCATIVA · Todo el contenido es ficticio</Text>
        </View>
        <FormError message={error} />

        {!intento && escenario ? (
          <>
            <View style={{ gap: space(2) }}>
              <View style={{ flexDirection: 'row', gap: space(1.5) }}>
                <Badge value="admin" label={escenario.tipo_nombre} />
                <Badge value="usuario" label={escenario.dificultad_nombre} />
              </View>
              <Text style={styles.titulo}>{escenario.titulo}</Text>
              <Text style={styles.texto}>{escenario.descripcion}</Text>
            </View>
            {escenario.contenido?.contexto ? (
              <Card style={{ gap: space(1) }}>
                <Text style={styles.etiqueta}>Situación</Text>
                <Text style={styles.texto}>{escenario.contenido.contexto}</Text>
              </Card>
            ) : null}
            <Card style={{ gap: space(2), backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
              <Text style={[styles.etiqueta, { color: colors.primaryDark }]}>Antes de empezar</Text>
              <Text style={styles.texto}>• Toma cada decisión como lo harías en la vida real.</Text>
              <Text style={styles.texto}>• Puede haber varias decisiones encadenadas.</Text>
              <Text style={styles.texto}>• Verás tu puntuación y la retroalimentación al terminar.</Text>
            </Card>
            <Button title="Comenzar simulación" onPress={comenzar} loading={enviando} />
          </>
        ) : null}

        {intento && paso ? (
          <>
            <View style={{ gap: space(1) }}>
              <Text style={styles.progreso}>Decisión {intento.decisiones_tomadas + 1}</Text>
              <Text style={styles.titulo}>{paso.titulo}</Text>
            </View>
            <ContenidoSimulado contenido={paso.contenido} />
            <Text style={styles.pregunta}>{paso.pregunta}</Text>
            <View style={{ gap: space(2.5) }} accessibilityRole="radiogroup">
              {paso.opciones.map((o) => {
                const activa = seleccion === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setSeleccion(o.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: activa }}
                    style={({ pressed }) => [styles.opcion, activa && styles.opcionActiva, pressed && { opacity: 0.85 }]}
                  >
                    <View style={[styles.radio, activa && styles.radioActivo]}>{activa ? <View style={styles.radioPunto} /> : null}</View>
                    <Text style={[styles.opcionTexto, activa && { color: colors.primaryDark, fontWeight: '600' }]}>{o.texto}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button title="Confirmar decisión" onPress={confirmar} loading={enviando} disabled={!seleccion} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: space(5), gap: space(4), width: '100%', maxWidth: 560, alignSelf: 'center' },
  aviso: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, paddingVertical: space(1.5), alignItems: 'center' },
  avisoText: { color: colors.warning, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { fontSize: 15, color: colors.text, lineHeight: 22 },
  etiqueta: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  progreso: { fontSize: 13, fontWeight: '700', color: colors.primary },
  pregunta: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: space(1) },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: space(4),
  },
  opcionActiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  opcionTexto: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActivo: { borderColor: colors.primary },
  radioPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  centro: { flex: 1, backgroundColor: colors.bg },
  evaluando: { textAlign: 'center', color: colors.textMuted, marginBottom: space(20) },
});
