import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Ionicons } from './ui';
import { NivelBadge } from './NivelBadge';
import { DIFICULTADES, puntos, tipoInfo } from '../lib/etiquetas';
import { colors, fonts, radius, space, type } from '../theme';

/** Indicador de dificultad con barras (1 a 3) además del texto. */
export function Dificultad({ clave, nombre }) {
  const n = DIFICULTADES[clave]?.nivel || 1;
  return (
    <View style={styles.dificultad} accessibilityLabel={`Dificultad ${nombre}`}>
      {[1, 2, 3].map((i) => <View key={i} style={[styles.barrita, { height: 4 + i * 3 }, i <= n && { backgroundColor: colors.primary }]} />)}
      <Text style={type.caption}>{nombre}</Text>
    </View>
  );
}

/** Tarjeta de escenario para el listado de simulaciones. */
export function ScenarioCard({ escenario: e, onPress, recomendado }) {
  const tipo = tipoInfo(e.tipo);
  return (
    <Card onPress={onPress} style={[{ gap: space(3) }, recomendado && styles.recomendado]} accessibilityLabel={`${e.titulo}, ${e.tipo_nombre}, ${e.dificultad_nombre}`}>
      <View style={styles.fila}>
        <View style={styles.icono}><Ionicons name={tipo.icon} size={22} color={colors.primary} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.overline}>{e.tipo_nombre} · {e.codigo}</Text>
          <Text style={type.h3}>{e.titulo}</Text>
        </View>
        {recomendado ? <Badge tone="navy" icon="star" label="Recomendado" /> : null}
      </View>
      <Text style={[type.body, { color: colors.textMuted }]} numberOfLines={3}>{e.descripcion}</Text>
      <View style={styles.pie}>
        <Dificultad clave={e.dificultad} nombre={e.dificultad_nombre} />
        {e.mis_intentos ? <NivelBadge nivel={e.mi_ultimo_nivel} prefijo="" /> : null}
        <View style={{ flex: 1 }} />
        {e.mis_intentos ? <Text style={type.caption}>Mejor: {puntos(e.mi_mejor_puntaje)} pts</Text> : null}
        <View style={styles.accion}>
          <Text style={styles.accionTexto}>{e.mis_intentos ? 'Repetir' : 'Comenzar'}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  recomendado: { borderColor: colors.primary, borderWidth: 1.5 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  icono: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pie: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(3) },
  dificultad: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barrita: { width: 5, borderRadius: 2, backgroundColor: colors.border },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  accionTexto: { fontFamily: fonts.semibold, color: colors.primary, fontSize: 14 },
});
