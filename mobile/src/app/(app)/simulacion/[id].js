import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../api/client';
import { ContenidoSimulado } from '../../../components/ContenidoSimulado';
import { Dificultad } from '../../../components/ScenarioCard';
import { Alert, Badge, Button, Card, ErrorState, Ionicons, Loading } from '../../../components/ui';
import { useFeedback } from '../../../context/FeedbackContext';
import { tipoInfo } from '../../../lib/etiquetas';
import { colors, fonts, radius, shadow, space, type } from '../../../theme';

const LETRAS = 'ABCDEFGH';

/**
 * Escenario: introducción → decisiones paso a paso → evaluación.
 * No se indica si una decisión fue correcta hasta el resultado final.
 */
export default function Escenario() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { toast } = useFeedback();
  const scrollRef = useRef(null);
  const [escenario, setEscenario] = useState(null);
  const [intento, setIntento] = useState(null);
  const [paso, setPaso] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => {
    setError('');
    api(`/scenarios/${id}`).then(({ escenario: e }) => setEscenario(e)).catch((e) => setError(e.message));
  };
  useEffect(cargar, [id]);

  async function comenzar() {
    setEnviando(true);
    try {
      const r = await api('/attempts', { method: 'POST', body: { escenario_id: Number(id) } });
      setIntento(r.intento);
      setPaso(r.paso);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    if (!seleccion) return;
    setEnviando(true);
    try {
      const r = await api(`/attempts/${intento.id}/responses`, { method: 'POST', body: { opcion_id: seleccion } });
      setIntento(r.intento);
      setSeleccion(null);
      if (r.paso) {
        setPaso(r.paso);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        setEvaluando(true);
        await api(`/attempts/${intento.id}/finish`, { method: 'POST' });
        router.replace(`/resultado/${intento.id}`);
      }
    } catch (e) {
      setEvaluando(false);
      toast.error(`No fue posible registrar tu decisión. ${e.message}`);
    } finally {
      setEnviando(false);
    }
  }

  if (evaluando) return <Loading message="Evaluando tus decisiones…" />;
  if (error) return <ErrorState message="No fue posible cargar el escenario. Intenta nuevamente." onRetry={cargar} />;
  if (!escenario) return <Loading />;

  const tipo = tipoInfo(escenario.tipo);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Stack.Screen options={{ title: intento ? `${escenario.codigo} · Decisión ${intento.decisiones_tomadas + 1}` : escenario.codigo }} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.aviso} accessibilityRole="text">
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={styles.avisoTexto}>Simulación educativa · todo el contenido es ficticio</Text>
        </View>

        {!intento ? (
          <>
            <View style={styles.introCabecera}>
              <View style={styles.introIcono}><Ionicons name={tipo.icon} size={30} color={colors.primary} /></View>
              <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Badge tone="info" label={escenario.tipo_nombre} icon={tipo.icon} />
                <Dificultad clave={escenario.dificultad} nombre={escenario.dificultad_nombre} />
              </View>
              <Text style={[type.h1, { textAlign: 'center' }]}>{escenario.titulo}</Text>
              <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{escenario.descripcion}</Text>
            </View>

            {escenario.contenido?.contexto ? (
              <Card style={{ gap: space(2) }}>
                <Text style={type.overline}>La situación</Text>
                <Text style={type.body}>{escenario.contenido.contexto}</Text>
              </Card>
            ) : null}

            <Card variant="soft" elevated={false} style={{ gap: space(2.5) }}>
              <Text style={[type.h3, { color: colors.navy }]}>Antes de empezar</Text>
              {[
                ['person-outline', 'Decide como lo harías en la vida real.'],
                ['git-branch-outline', 'Puede haber varias decisiones encadenadas.'],
                ['eye-off-outline', 'No sabrás si acertaste hasta el final.'],
              ].map(([icon, texto]) => (
                <View key={icon} style={{ flexDirection: 'row', gap: space(2.5), alignItems: 'center' }}>
                  <Ionicons name={icon} size={18} color={colors.primary} />
                  <Text style={[type.body, { flex: 1 }]}>{texto}</Text>
                </View>
              ))}
            </Card>

            <Button title="Comenzar escenario" size="lg" icon="play" onPress={comenzar} loading={enviando} />
          </>
        ) : null}

        {intento && paso ? (
          <>
            <View style={{ gap: space(1) }}>
              <Text style={[type.overline, { color: colors.primary }]}>Decisión {intento.decisiones_tomadas + 1}</Text>
              <Text style={type.h2}>{paso.titulo}</Text>
            </View>

            <ContenidoSimulado contenido={paso.contenido} />

            <Text style={[type.h2, { marginTop: space(2) }]}>{paso.pregunta}</Text>
            <View style={{ gap: space(2.5) }} accessibilityRole="radiogroup" accessibilityLabel={paso.pregunta}>
              {paso.opciones.map((o, i) => {
                const activa = seleccion === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setSeleccion(o.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: activa }}
                    accessibilityLabel={o.texto}
                    style={({ pressed, hovered }) => [styles.opcion, hovered && !activa && { borderColor: '#BFD4FB' }, activa && styles.opcionActiva, pressed && { opacity: 0.9 }]}
                  >
                    <View style={[styles.letra, activa && styles.letraActiva]}>
                      {activa ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : <Text style={styles.letraTexto}>{LETRAS[i]}</Text>}
                    </View>
                    <Text style={[type.body, { flex: 1 }, activa && { fontFamily: fonts.semibold, color: colors.navy }]}>{o.texto}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Alert tone="info" message="Tu decisión se registrará y continuarás con el escenario. Verás la evaluación al terminar." />
            <Button title="Confirmar decisión" size="lg" iconRight="arrow-forward" onPress={confirmar} loading={enviando} disabled={!seleccion} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: space(5), gap: space(4), width: '100%', maxWidth: 600, alignSelf: 'center' },
  aviso: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2),
    backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(3),
  },
  avisoTexto: { fontFamily: fonts.semibold, fontSize: 12, color: colors.navy },
  introCabecera: { alignItems: 'center', gap: space(3), marginTop: space(2) },
  introIcono: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, padding: space(4), ...shadow.sm,
  },
  opcionActiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  letra: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  letraActiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  letraTexto: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
});
