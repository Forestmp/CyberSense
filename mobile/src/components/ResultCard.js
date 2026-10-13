import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, ProgressBar } from './ui';
import { NivelBadge } from './NivelBadge';
import { nivelInfo, puntos } from '../lib/etiquetas';
import { colors, fonts, radius, shadow, space, type } from '../theme';

function Indicador({ icon, color, valor, etiqueta }) {
  return (
    <View style={styles.indicador} accessibilityLabel={`${etiqueta}: ${valor}`}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.indicadorValor}>{valor}</Text>
      <Text style={styles.indicadorEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

/** Resumen del resultado de una simulación: puntaje, nivel e indicadores. */
export function ResultCard({ resultado: r, titulo, subtitulo }) {
  const nivel = nivelInfo(r.nivel_vulnerabilidad?.nivel);
  return (
    <View style={[styles.tarjeta, shadow.md]}>
      <View style={[styles.franja, { backgroundColor: nivel.bar }]} />
      {titulo ? <Text style={[type.overline, { textAlign: 'center' }]}>{titulo}</Text> : null}
      <View style={[styles.anillo, { borderColor: nivel.bar }]} accessibilityLabel={`Puntuación ${puntos(r.puntaje)} de 100`}>
        <Text style={styles.puntaje}>{puntos(r.puntaje)}</Text>
        <Text style={type.caption}>de 100</Text>
      </View>
      <NivelBadge nivel={r.nivel_vulnerabilidad?.nivel} grande />
      {r.nivel_vulnerabilidad?.descripcion ? (
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{r.nivel_vulnerabilidad.descripcion}</Text>
      ) : null}
      <View style={{ alignSelf: 'stretch' }}>
        <ProgressBar value={r.puntaje} color={nivel.bar} label="Puntuación" />
      </View>
      <View style={styles.indicadores}>
        <Indicador icon="checkmark-circle" color={colors.success} valor={r.aciertos} etiqueta="Decisiones seguras" />
        <Indicador icon="close-circle" color={colors.danger} valor={r.errores} etiqueta="Errores" />
        <Indicador icon="flag" color={colors.primary} valor={`${r.senales.detectadas.length}/${r.senales.total}`} etiqueta="Señales detectadas" />
      </View>
      {subtitulo ? <Text style={type.caption}>{subtitulo}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: space(5), paddingTop: space(6), alignItems: 'center', gap: space(3), overflow: 'hidden',
  },
  franja: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  anillo: { width: 128, height: 128, borderRadius: 64, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  puntaje: { fontFamily: fonts.extrabold, fontSize: 38, color: colors.navy, lineHeight: 44 },
  indicadores: { flexDirection: 'row', alignSelf: 'stretch', borderTopWidth: 1, borderColor: colors.border, paddingTop: space(3), marginTop: space(1) },
  indicador: { flex: 1, alignItems: 'center', gap: 2 },
  indicadorValor: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  indicadorEtiqueta: { ...type.caption, textAlign: 'center' },
});
