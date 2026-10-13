import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { Button, Card, EmptyState, FormError, Loading, Screen } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { nivelInfo, puntos } from '../../../lib/etiquetas';
import { colors, radius, space } from '../../../theme';

function Barra({ valor, color = colors.primary }) {
  return (
    <View style={styles.barraFondo} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(valor || 0) }}>
      <View style={[styles.barra, { width: `${Math.max(0, Math.min(100, valor || 0))}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function Progreso() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [m, setM] = useState(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    api(`/users/${usuario.id}/metrics`).then(setM).catch((e) => setError(e.message));
  }, [usuario.id]));

  if (!m && !error) return <Loading />;
  if (!m) return <Screen><FormError message={error} /></Screen>;

  const { resumen, por_tipo: porTipo, evolucion } = m;
  if (!resumen.total_simulaciones) {
    return (
      <Screen contentStyle={{ justifyContent: 'center' }}>
        <EmptyState title="Tu progreso aparecerá aquí" message="Completa tu primera simulación para ver tus métricas por tipo de ataque.">
          <Button title="Iniciar simulación" onPress={() => router.push('/simulaciones')} style={{ marginTop: space(3) }} />
        </EmptyState>
      </Screen>
    );
  }

  const nivelGeneral = nivelInfo(resumen.nivel_vulnerabilidad);

  return (
    <Screen>
      <Card style={{ gap: space(3) }}>
        <Text style={styles.seccion}>Resumen general</Text>
        <View style={styles.grid}>
          <View style={styles.kpi}><Text style={styles.kpiValor}>{resumen.total_simulaciones}</Text><Text style={styles.kpiEtiqueta}>Simulaciones</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiValor}>{puntos(resumen.puntaje_promedio)}</Text><Text style={styles.kpiEtiqueta}>Puntaje promedio</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiValor}>{resumen.tasa_aciertos ?? '—'}%</Text><Text style={styles.kpiEtiqueta}>Decisiones seguras</Text></View>
          <View style={styles.kpi}>
            <Text style={styles.kpiValor}>{resumen.escenarios_completados}/{resumen.escenarios_disponibles}</Text>
            <Text style={styles.kpiEtiqueta}>Escenarios realizados</Text>
          </View>
        </View>
        <View style={[styles.nivel, { backgroundColor: nivelGeneral.bg }]}>
          <Text style={{ color: nivelGeneral.fg, fontWeight: '700' }}>Vulnerabilidad general: {nivelGeneral.label}</Text>
        </View>
      </Card>

      <Text style={styles.titulo}>Por tipo de ataque</Text>
      {porTipo.map((t) => {
        const nivel = nivelInfo(t.nivel_vulnerabilidad);
        const total = t.aciertos + t.errores;
        return (
          <Card key={t.tipo} style={{ gap: space(2.5), opacity: t.total_intentos ? 1 : 0.6 }}>
            <View style={styles.fila}>
              <Text style={styles.seccion}>{t.tipo_nombre}</Text>
              {t.total_intentos ? (
                <View style={[styles.pill, { backgroundColor: nivel.bg }]}><Text style={{ color: nivel.fg, fontSize: 12, fontWeight: '700' }}>{nivel.label}</Text></View>
              ) : <Text style={styles.meta}>Sin práctica</Text>}
            </View>
            {t.total_intentos ? (
              <>
                <View style={styles.fila}>
                  <Text style={styles.meta}>Puntaje promedio</Text>
                  <Text style={styles.valor}>{puntos(t.puntaje_promedio)} / 100</Text>
                </View>
                <Barra valor={t.puntaje_promedio} color={nivel.fg} />
                <View style={styles.fila}>
                  <Text style={styles.meta}>{t.total_intentos} intento(s) · último: {puntos(t.ultimo_puntaje)}</Text>
                  <Text style={styles.meta}>
                    <Text style={{ color: colors.success, fontWeight: '700' }}>{t.aciertos} seguras</Text>
                    {' · '}
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>{t.errores} errores</Text>
                  </Text>
                </View>
                {total ? <Barra valor={(t.aciertos / total) * 100} color={colors.success} /> : null}
              </>
            ) : null}
          </Card>
        );
      })}

      {evolucion.length > 1 ? (
        <Card style={{ gap: space(3) }}>
          <Text style={styles.seccion}>Últimas simulaciones</Text>
          <View style={styles.grafica}>
            {evolucion.map((e) => (
              <View key={e.intento_id} style={styles.columna}>
                <Text style={styles.colValor}>{Math.round(e.puntaje)}</Text>
                <View style={[styles.colBarra, { height: `${Math.max(4, e.puntaje)}%`, backgroundColor: colors.primary }]} />
              </View>
            ))}
          </View>
          <Text style={styles.meta}>Puntaje de cada simulación, de la más antigua a la más reciente.</Text>
        </Card>
      ) : null}

      <Text style={styles.nota}>{m.nota}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: space(1) },
  seccion: { fontSize: 16, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(3) },
  kpi: { width: '50%', gap: 2 },
  kpiValor: { fontSize: 24, fontWeight: '800', color: colors.text },
  kpiEtiqueta: { fontSize: 12, color: colors.textMuted },
  nivel: { borderRadius: radius.md, padding: space(3), alignItems: 'center' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
  meta: { fontSize: 12, color: colors.textMuted },
  valor: { fontSize: 14, fontWeight: '700', color: colors.text },
  pill: { borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: 2 },
  barraFondo: { height: 8, borderRadius: 4, backgroundColor: colors.neutralSoft, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4 },
  grafica: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: space(2) },
  columna: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  colValor: { fontSize: 10, color: colors.textMuted },
  colBarra: { width: '70%', maxWidth: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: 0.8 },
  nota: { fontSize: 12, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
});
