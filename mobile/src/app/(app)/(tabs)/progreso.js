import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { NivelBadge } from '../../../components/NivelBadge';
import { Button, Card, EmptyState, ErrorState, Ionicons, Loading, ProgressBar, Screen, SectionTitle } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { nivelInfo, puntos, tipoInfo } from '../../../lib/etiquetas';
import { colors, fonts, radius, space, type } from '../../../theme';

function Kpi({ icon, valor, etiqueta }) {
  return (
    <Card style={styles.kpi} accessibilityLabel={`${etiqueta}: ${valor}`}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.kpiValor}>{valor}</Text>
      <Text style={type.caption}>{etiqueta}</Text>
    </Card>
  );
}

export default function Progreso() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [m, setM] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setError('');
    api(`/users/${usuario.id}/metrics`).then(setM).catch((e) => setError(e.message));
  }, [usuario.id]);
  useFocusEffect(cargar);

  if (error) return <ErrorState message="No fue posible cargar tu progreso. Intenta nuevamente." onRetry={cargar} />;
  if (!m) return <Loading />;

  const { resumen, por_tipo: porTipo, evolucion } = m;
  if (!resumen.total_simulaciones) {
    return (
      <Screen contentStyle={{ justifyContent: 'center' }}>
        <EmptyState icon="stats-chart-outline" title="Tu progreso aparecerá aquí" message="Completa tu primera simulación para ver tu desempeño por tipo de ataque.">
          <Button title="Iniciar simulación" icon="play" onPress={() => router.push('/simulaciones')} style={{ marginTop: space(2), alignSelf: 'center' }} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card variant="navy" style={{ gap: space(3) }}>
        <Text style={[type.overline, { color: '#93C5FD' }]}>Desempeño general</Text>
        <View style={styles.generalFila}>
          <View style={{ gap: space(1.5), flex: 1 }}>
            <Text style={styles.generalValor}>{puntos(resumen.puntaje_promedio)}<Text style={styles.generalDe}> / 100</Text></Text>
            <Text style={{ color: '#CBD5E1', fontFamily: fonts.regular }}>Puntuación promedio</Text>
          </View>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: radius.pill, padding: 2 }}>
            <NivelBadge nivel={resumen.nivel_vulnerabilidad} prefijo="" grande />
          </View>
        </View>
        <ProgressBar value={resumen.puntaje_promedio} color={colors.cyan} track="rgba(255,255,255,0.18)" label="Puntuación promedio" />
      </Card>

      <View style={styles.kpis}>
        <Kpi icon="play-circle-outline" valor={resumen.total_simulaciones} etiqueta="Intentos realizados" />
        <Kpi icon="checkmark-done-outline" valor={`${resumen.tasa_aciertos ?? 0}%`} etiqueta="Decisiones seguras" />
        <Kpi icon="layers-outline" valor={`${resumen.escenarios_completados}/${resumen.escenarios_disponibles}`} etiqueta="Escenarios realizados" />
      </View>

      <SectionTitle>Por tipo de ataque</SectionTitle>
      {porTipo.map((t) => {
        const nivel = nivelInfo(t.nivel_vulnerabilidad);
        const tipo = tipoInfo(t.tipo);
        const total = t.aciertos + t.errores;
        return (
          <Card key={t.tipo} style={{ gap: space(3) }}>
            <View style={styles.tipoFila}>
              <View style={styles.tipoIcono}><Ionicons name={tipo.icon} size={20} color={colors.primary} /></View>
              <Text style={[type.h3, { flex: 1 }]}>{t.tipo_nombre}</Text>
              {t.total_intentos ? <NivelBadge nivel={t.nivel_vulnerabilidad} prefijo="" /> : <Text style={type.caption}>Sin práctica</Text>}
            </View>
            {t.total_intentos ? (
              <>
                <View style={styles.fila}>
                  <Text style={type.small}>Puntuación promedio</Text>
                  <Text style={type.bodyStrong}>{puntos(t.puntaje_promedio)} / 100</Text>
                </View>
                <ProgressBar value={t.puntaje_promedio} color={nivel.bar} label={`Puntuación promedio en ${t.tipo_nombre}`} />
                <View style={styles.fila}>
                  <Text style={type.small}>{t.total_intentos} intento(s) · último {puntos(t.ultimo_puntaje)}</Text>
                  <Text style={type.small}>
                    <Text style={{ color: colors.successText, fontFamily: fonts.semibold }}>{t.aciertos} {t.aciertos === 1 ? 'segura' : 'seguras'}</Text>
                    {' · '}
                    <Text style={{ color: colors.dangerText, fontFamily: fonts.semibold }}>{t.errores} {t.errores === 1 ? 'error' : 'errores'}</Text>
                  </Text>
                </View>
                {total ? <ProgressBar value={(t.aciertos / total) * 100} color={colors.success} height={6} label="Proporción de decisiones seguras" /> : null}
              </>
            ) : (
              <Button title={`Practicar ${t.tipo_nombre.toLowerCase()}`} small variant="secondary" onPress={() => router.push('/simulaciones')} />
            )}
          </Card>
        );
      })}

      {evolucion.length > 1 ? (
        <>
          <SectionTitle>Últimas simulaciones</SectionTitle>
          <Card style={{ gap: space(3) }}>
            <View style={styles.grafica} accessibilityLabel={`Puntajes recientes: ${evolucion.map((e) => Math.round(e.puntaje)).join(', ')}`}>
              {evolucion.map((e) => (
                <View key={e.intento_id} style={styles.columna}>
                  <Text style={type.caption}>{Math.round(e.puntaje)}</Text>
                  <View style={[styles.barra, { height: `${Math.max(4, e.puntaje)}%`, backgroundColor: nivelInfo(e.puntaje >= 80 ? 'bajo' : e.puntaje >= 60 ? 'medio' : e.puntaje >= 40 ? 'alto' : 'critico').bar }]} />
                </View>
              ))}
            </View>
            <Text style={type.caption}>Puntuación de cada simulación, de la más antigua a la más reciente.</Text>
          </Card>
        </>
      ) : null}

      <Text style={[type.caption, { textAlign: 'center', fontStyle: 'italic' }]}>{m.nota}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  generalFila: { flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap' },
  generalValor: { fontFamily: fonts.extrabold, fontSize: 36, color: '#FFFFFF' },
  generalDe: { fontFamily: fonts.medium, fontSize: 16, color: '#93C5FD' },
  kpis: { flexDirection: 'row', gap: space(3) },
  kpi: { flex: 1, gap: space(1), padding: space(3) },
  kpiValor: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  tipoFila: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  tipoIcono: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
  grafica: { flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: space(2) },
  columna: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  barra: { width: '70%', maxWidth: 28, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
});
