import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIntento } from '../../../hooks/useIntento';
import { ResultCard } from '../../../components/ResultCard';
import { Button, Card, ErrorState, Ionicons, Loading, Screen, SectionTitle } from '../../../components/ui';
import { fechaHora, VALORACIONES } from '../../../lib/etiquetas';
import { colors, space, type } from '../../../theme';

export default function Resultado() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { datos, error, cargar } = useIntento(id);

  if (error) return <ErrorState message="No fue posible cargar los resultados. Intenta nuevamente." onRetry={cargar} />;
  if (!datos) return <Loading />;
  if (!datos.resultado) return <ErrorState message="Este intento aún no tiene resultados." />;

  const { resultado: r, escenario, intento } = datos;

  return (
    <Screen>
      <ResultCard
        resultado={r}
        titulo={`${escenario.codigo} · ${escenario.titulo}`}
        subtitulo={`Intento ${intento.numero_intento} · ${fechaHora(intento.fecha_fin)}`}
      />

      <SectionTitle>Resumen de decisiones</SectionTitle>
      <Card style={{ gap: space(3) }}>
        {r.decisiones.map((d, i) => {
          const v = VALORACIONES[d.valoracion];
          return (
            <View key={d.orden} style={[styles.decision, i > 0 && styles.separador]}>
              <Ionicons name={v.icon} size={22} color={v.fg} accessibilityLabel={v.label} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.bodyStrong}>{d.opcion}</Text>
                <Text style={[type.caption, { color: v.fg }]}>{v.label}{d.paso ? ` · ${d.paso}` : ''}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      {r.errores_detalle.length ? (
        <Card variant="outline" elevated={false} style={styles.aviso}>
          <Ionicons name="warning-outline" size={20} color={colors.warningText} />
          <Text style={[type.body, { flex: 1 }]}>
            Cometiste {r.errores_detalle.length} {r.errores_detalle.length === 1 ? 'error' : 'errores'}. Revisa los detalles para saber qué señales pasaste por alto.
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: space(2.5) }}>
        <Button title="Ver detalles" icon="school-outline" onPress={() => router.push(`/retroalimentacion/${id}`)} />
        <Button title="Continuar" icon="arrow-forward" variant="secondary" onPress={() => router.dismissTo('/simulaciones')} />
        <Button title="Volver al inicio" variant="ghost" icon="home-outline" onPress={() => router.dismissTo('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  decision: { flexDirection: 'row', gap: space(3), alignItems: 'center' },
  separador: { borderTopWidth: 1, borderColor: colors.border, paddingTop: space(3) },
  aviso: { flexDirection: 'row', gap: space(3), alignItems: 'center', backgroundColor: colors.warningSoft, borderColor: colors.warningSoft },
});
