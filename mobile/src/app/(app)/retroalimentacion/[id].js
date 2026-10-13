import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Accordion } from '../../../components/Accordion';
import { NivelBadge } from '../../../components/NivelBadge';
import { Alert, Button, ErrorState, Ionicons, Loading, Screen } from '../../../components/ui';
import { puntos, VALORACIONES } from '../../../lib/etiquetas';
import { colors, space, type } from '../../../theme';
import { useIntento } from '../../../hooks/useIntento';

function Item({ icon, color, titulo, texto, normal }) {
  return (
    <View style={styles.item}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={normal ? type.body : type.bodyStrong}>{titulo}</Text>
        {texto ? <Text style={[type.body, { color: colors.textMuted }]}>{texto}</Text> : null}
      </View>
    </View>
  );
}

/** Retroalimentación educativa detallada de un intento. */
export default function Retroalimentacion() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { datos, error, cargar } = useIntento(id);

  if (error) return <ErrorState message="No fue posible cargar la retroalimentación. Intenta nuevamente." onRetry={cargar} />;
  if (!datos) return <Loading />;
  if (!datos.resultado) return <ErrorState message="Este intento aún no tiene resultados." />;

  const { resultado: r, escenario } = datos;
  const correctas = r.decisiones.filter((d) => d.valoracion === 'correcta');
  const mejorables = r.decisiones.filter((d) => d.valoracion === 'mejorable');
  const penalizaciones = r.reglas_aplicadas.filter((x) => x.ajuste < 0);

  return (
    <Screen>
      <View style={{ gap: space(2) }}>
        <Text style={type.overline}>{escenario.codigo} · {escenario.tipo_nombre}</Text>
        <Text style={type.h1}>{escenario.titulo}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap' }}>
          <Text style={type.bodyStrong}>{puntos(r.puntaje)} / 100</Text>
          <NivelBadge nivel={r.nivel_vulnerabilidad?.nivel} />
        </View>
      </View>

      <Accordion icon="flag-outline" title="Señales de alerta presentes" count={r.senales.total} defaultOpen>
        {r.senales.detectadas.map((s) => (
          <Item key={s.clave} icon="checkmark-circle" color={colors.success} titulo={`Identificaste: ${s.descripcion}`} texto={s.explicacion} />
        ))}
        {r.senales.no_detectadas.map((s) => (
          <Item key={s.clave} icon="alert-circle" color={colors.warningText} titulo={`No identificaste: ${s.descripcion}`} texto={s.explicacion} />
        ))}
      </Accordion>

      <Accordion icon="checkmark-done-outline" iconColor={colors.success} title="Decisiones correctas" count={correctas.length}>
        {correctas.length ? correctas.map((d) => (
          <Item key={d.orden} icon={VALORACIONES.correcta.icon} color={colors.success} titulo={d.opcion} texto={d.retroalimentacion} />
        )) : <Text style={type.body}>En este intento no tomaste decisiones completamente seguras.</Text>}
        {mejorables.map((d) => (
          <Item key={d.orden} icon={VALORACIONES.mejorable.icon} color={colors.warningText} titulo={`Mejorable: ${d.opcion}`} texto={d.retroalimentacion} />
        ))}
      </Accordion>

      <Accordion icon="close-circle-outline" iconColor={colors.danger} title="Errores cometidos" count={r.errores_detalle.length + penalizaciones.length} defaultOpen={r.errores_detalle.length > 0}>
        {r.errores_detalle.length === 0 && penalizaciones.length === 0 ? (
          <Alert tone="success" message="No tomaste decisiones riesgosas en este escenario." />
        ) : null}
        {r.errores_detalle.map((d) => (
          <Item key={d.orden} icon={VALORACIONES.incorrecta.icon} color={colors.danger} titulo={d.opcion} texto={d.retroalimentacion} />
        ))}
        {penalizaciones.map((x) => (
          <Item key={x.descripcion} icon="warning" color={colors.danger} titulo={x.descripcion} texto={x.retroalimentacion} />
        ))}
      </Accordion>

      {r.ruta_recomendada?.length ? (
        <Accordion icon="navigate-outline" title="Lo más seguro habría sido" count={r.ruta_recomendada.length}>
          {r.ruta_recomendada.map((p, i) => (
            <View key={i} style={styles.item}>
              <View style={styles.numero}><Text style={[type.caption, { color: colors.primary }]}>{i + 1}</Text></View>
              <Text style={[type.body, { flex: 1 }]}>{p.opcion}</Text>
            </View>
          ))}
        </Accordion>
      ) : null}

      <Accordion icon="bulb-outline" iconColor={colors.warningText} title="Recomendaciones" count={r.recomendaciones.length} defaultOpen>
        {r.recomendaciones.map((t, i) => (
          <Item key={i} icon="arrow-forward-circle" color={colors.primary} titulo={t} normal />
        ))}
      </Accordion>

      <Text style={[type.caption, { textAlign: 'center', fontStyle: 'italic' }]}>
        Los niveles de vulnerabilidad son provisionales y se definirán formalmente durante el análisis del proyecto.
      </Text>

      <Button title="Intentar de nuevo" icon="refresh" variant="secondary" onPress={() => router.push(`/simulacion/${escenario.id}`)} />
      <Button title="Volver al inicio" variant="ghost" icon="home-outline" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  numero: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
