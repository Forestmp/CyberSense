import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { Button, Card, FormError, Loading, Screen } from '../../../components/ui';
import { fechaHora, nivelInfo, puntos, VALORACIONES } from '../../../lib/etiquetas';
import { colors, radius, space } from '../../../theme';

function Seccion({ titulo, children }) {
  return (
    <Card style={{ gap: space(3) }}>
      <Text style={styles.seccion}>{titulo}</Text>
      {children}
    </Card>
  );
}

function Dato({ valor, etiqueta, color }) {
  return (
    <View style={styles.dato}>
      <Text style={[styles.datoValor, color && { color }]}>{valor}</Text>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

export default function Resultado() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/attempts/${id}`).then(setDatos).catch((e) => setError(e.message));
  }, [id]);

  if (!datos && !error) return <Loading />;
  if (!datos?.resultado) {
    return <Screen><FormError message={error || 'Este intento no tiene resultados.'} /></Screen>;
  }

  const { resultado: r, escenario, intento } = datos;
  const nivel = nivelInfo(r.nivel_vulnerabilidad?.nivel);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Resultado', headerBackVisible: true }} />

      <View style={[styles.hero, { borderColor: nivel.fg }]}>
        <Text style={styles.heroEscenario}>{escenario.codigo} · {escenario.titulo}</Text>
        <View style={styles.puntajeFila}>
          <Text style={styles.puntaje}>{puntos(r.puntaje)}</Text>
          <Text style={styles.puntajeMax}>/ 100</Text>
        </View>
        <View style={[styles.nivel, { backgroundColor: nivel.bg }]}>
          <Text style={[styles.nivelText, { color: nivel.fg }]}>Vulnerabilidad {nivel.label.toLowerCase()}</Text>
        </View>
        {r.nivel_vulnerabilidad?.descripcion ? <Text style={styles.heroDesc}>{r.nivel_vulnerabilidad.descripcion}</Text> : null}
        <View style={styles.datos}>
          <Dato valor={r.aciertos} etiqueta="Decisiones seguras" color={colors.success} />
          <Dato valor={r.errores} etiqueta="Errores" color={r.errores ? colors.danger : colors.text} />
          <Dato valor={`${r.senales.detectadas.length}/${r.senales.total}`} etiqueta="Señales detectadas" />
        </View>
        <Text style={styles.fecha}>Intento {intento.numero_intento} · {fechaHora(intento.fecha_fin)}</Text>
      </View>

      <Seccion titulo="Tu recorrido">
        {r.decisiones.map((d) => {
          const v = VALORACIONES[d.valoracion];
          return (
            <View key={d.orden} style={styles.decision}>
              <View style={[styles.icono, { backgroundColor: v.bg }]}><Text style={{ color: v.fg, fontWeight: '800' }}>{v.icono}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                {d.paso ? <Text style={styles.paso}>{d.paso}</Text> : null}
                <Text style={styles.opcion}>{d.opcion}</Text>
                <Text style={[styles.valoracion, { color: v.fg }]}>{v.label}</Text>
                {d.retroalimentacion ? <Text style={styles.retro}>{d.retroalimentacion}</Text> : null}
              </View>
            </View>
          );
        })}
      </Seccion>

      <Seccion titulo="Errores cometidos">
        {r.errores_detalle.length === 0 ? (
          <Text style={styles.retro}>No tomaste decisiones riesgosas en este escenario. ¡Bien hecho!</Text>
        ) : r.errores_detalle.map((d) => (
          <View key={d.orden} style={styles.alerta}>
            <Text style={[styles.opcion, { color: colors.danger }]}>✕ {d.opcion}</Text>
            {d.retroalimentacion ? <Text style={styles.retro}>{d.retroalimentacion}</Text> : null}
          </View>
        ))}
        {r.reglas_aplicadas.filter((x) => x.ajuste < 0).map((x) => (
          <View key={x.descripcion} style={styles.alerta}>
            <Text style={[styles.opcion, { color: colors.danger }]}>! {x.descripcion}</Text>
          </View>
        ))}
      </Seccion>

      <Seccion titulo="Señales de alerta">
        {r.senales.detectadas.map((s) => (
          <View key={s.clave} style={styles.senal}>
            <Text style={[styles.opcion, { color: colors.success }]}>✓ {s.descripcion}</Text>
            <Text style={styles.retro}>{s.explicacion}</Text>
          </View>
        ))}
        {r.senales.no_detectadas.length ? <Text style={styles.subseccion}>No las identificaste</Text> : null}
        {r.senales.no_detectadas.map((s) => (
          <View key={s.clave} style={styles.senal}>
            <Text style={[styles.opcion, { color: colors.warning }]}>⚠ {s.descripcion}</Text>
            <Text style={styles.retro}>{s.explicacion}</Text>
          </View>
        ))}
      </Seccion>

      {r.ruta_recomendada?.length ? (
        <Seccion titulo="Lo más seguro habría sido">
          {r.ruta_recomendada.map((p, i) => (
            <Text key={i} style={styles.retro}>{i + 1}. {p.opcion}</Text>
          ))}
        </Seccion>
      ) : null}

      <Seccion titulo="Recomendaciones">
        {r.recomendaciones.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space(2) }}>
            <Text style={{ color: colors.primary }}>•</Text>
            <Text style={[styles.retro, { flex: 1 }]}>{t}</Text>
          </View>
        ))}
      </Seccion>

      <Text style={styles.nota}>
        Los niveles de vulnerabilidad son provisionales y se definirán formalmente durante el análisis del proyecto.
      </Text>

      <Button title="Intentar de nuevo" variant="secondary" onPress={() => router.replace(`/simulacion/${escenario.id}`)} />
      <Button title="Volver al inicio" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, padding: space(5), alignItems: 'center', gap: space(2) },
  heroEscenario: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  puntajeFila: { flexDirection: 'row', alignItems: 'baseline', gap: space(1) },
  puntaje: { fontSize: 56, fontWeight: '800', color: colors.text },
  puntajeMax: { fontSize: 18, color: colors.textMuted },
  nivel: { borderRadius: 999, paddingHorizontal: space(4), paddingVertical: space(1.5) },
  nivelText: { fontWeight: '700' },
  heroDesc: { color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  datos: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space(2), borderTopWidth: 1, borderColor: colors.border, paddingTop: space(3) },
  dato: { flex: 1, alignItems: 'center', gap: 2 },
  datoValor: { fontSize: 20, fontWeight: '700', color: colors.text },
  datoEtiqueta: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  fecha: { fontSize: 12, color: colors.textMuted, marginTop: space(1) },
  seccion: { fontSize: 16, fontWeight: '700', color: colors.text },
  subseccion: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: space(1) },
  decision: { flexDirection: 'row', gap: space(3) },
  icono: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  paso: { fontSize: 12, color: colors.textMuted },
  opcion: { fontSize: 15, fontWeight: '600', color: colors.text },
  valoracion: { fontSize: 12, fontWeight: '700' },
  retro: { fontSize: 14, color: colors.text, lineHeight: 20 },
  alerta: { gap: 2, borderLeftWidth: 3, borderColor: colors.danger, paddingLeft: space(3) },
  senal: { gap: 2 },
  nota: { fontSize: 12, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
});
