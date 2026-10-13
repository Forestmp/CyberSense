import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { FORMATOS } from '../lib/formatos';

/**
 * Representa el contenido ficticio de un paso. Los enlaces y botones se
 * dibujan, pero nunca son interactivos: las decisiones se toman con las
 * opciones de abajo.
 */
export function ContenidoSimulado({ contenido }) {
  const Vista = VISTAS[contenido?.formato] || Generico;
  return <Vista c={contenido || {}} />;
}

function Correo({ c }) {
  const inicial = (c.remitente_nombre || c.remitente_correo || '?').charAt(0).toUpperCase();
  return (
    <View style={s.marco}>
      <View style={s.correoHeader}>
        <View style={s.avatar}><Text style={s.avatarText}>{inicial}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.negrita} numberOfLines={1}>{c.remitente_nombre}</Text>
          {c.remitente_correo ? <Text style={s.tenue} numberOfLines={1}>&lt;{c.remitente_correo}&gt;</Text> : null}
        </View>
        {c.fecha ? <Text style={s.tenue}>{c.fecha}</Text> : null}
      </View>
      {c.asunto ? <Text style={s.asunto}>{c.asunto}</Text> : null}
      {c.cuerpo ? <Text style={s.cuerpo}>{c.cuerpo}</Text> : null}
      {c.enlace_texto ? (
        <View style={s.botonFalso}><Text style={s.botonFalsoText}>{c.enlace_texto}</Text></View>
      ) : null}
      {c.enlace_url ? <Text style={s.urlPie} numberOfLines={2}>{c.enlace_url}</Text> : null}
    </View>
  );
}

function Sms({ c }) {
  return (
    <View style={[s.marco, { backgroundColor: '#F8FAFC' }]}>
      <Text style={[s.negrita, { textAlign: 'center' }]}>{c.remitente || c.aplicacion}</Text>
      {c.aplicacion && c.remitente ? <Text style={[s.tenue, { textAlign: 'center' }]}>{c.aplicacion}</Text> : null}
      {c.fecha ? <Text style={[s.tenue, { textAlign: 'center', marginTop: space(1) }]}>{c.fecha}</Text> : null}
      <View style={s.burbuja}>
        <Text style={s.cuerpo}>{c.mensaje}</Text>
        {c.enlace_url ? <Text style={s.enlaceTexto}>{c.enlace_url}</Text> : null}
      </View>
    </View>
  );
}

function SitioWeb({ c }) {
  const inseguro = typeof c.url === 'string' && c.url.startsWith('http://');
  return (
    <View style={[s.marco, { padding: 0, overflow: 'hidden' }]}>
      <View style={s.barraNavegador}>
        <Text style={[s.candado, inseguro && { color: colors.danger }]}>{inseguro ? 'No seguro' : '🔒'}</Text>
        <Text style={s.barraUrl} numberOfLines={1}>{c.url}</Text>
      </View>
      <View style={{ padding: space(4), gap: space(3) }}>
        {c.titulo_pagina ? <Text style={s.asunto}>{c.titulo_pagina}</Text> : null}
        {c.mensaje ? <Text style={s.cuerpo}>{c.mensaje}</Text> : null}
        {(Array.isArray(c.campos) ? c.campos : []).map((campo) => (
          <View key={campo} style={{ gap: space(1) }}>
            <Text style={s.etiquetaCampo}>{campo}</Text>
            <View style={s.campoFalso} />
          </View>
        ))}
        {Array.isArray(c.campos) && c.campos.length ? (
          <View style={s.botonFalso}><Text style={s.botonFalsoText}>Continuar</Text></View>
        ) : null}
      </View>
    </View>
  );
}

function Llamada({ c }) {
  return (
    <View style={[s.marco, { alignItems: 'center', gap: space(2) }]}>
      <View style={[s.avatar, { width: 56, height: 56, borderRadius: 28 }]}><Text style={s.avatarText}>☎</Text></View>
      <Text style={s.negrita}>{c.llamante}</Text>
      {c.numero ? <Text style={s.tenue}>{c.numero}</Text> : null}
      {c.transcripcion ? <Text style={[s.cuerpo, { fontStyle: 'italic', textAlign: 'center' }]}>“{c.transcripcion}”</Text> : null}
    </View>
  );
}

function Detalle({ c, filas }) {
  return (
    <View style={[s.marco, { gap: space(2.5) }]}>
      {filas.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => (
        <View key={k} style={{ gap: 2 }}>
          <Text style={s.etiquetaCampo}>{k}</Text>
          <Text style={s.cuerpo}>{v}</Text>
        </View>
      ))}
      {c.nota ? <View style={s.nota}><Text style={{ color: colors.text, lineHeight: 20 }}>{c.nota}</Text></View> : null}
    </View>
  );
}

const DetalleRemitente = ({ c }) => (
  <Detalle c={c} filas={[['Nombre visible', c.remitente_nombre], ['Dirección de correo', c.remitente_correo], ['Dominio', c.dominio]]} />
);

const DetalleUrl = ({ c }) => (
  <Detalle c={c} filas={[
    ['Dirección completa', c.url], ['Dominio real', c.dominio_real],
    ['Conexión', c.usa_https === undefined ? undefined : c.usa_https ? 'Segura (HTTPS)' : 'No segura (HTTP)'],
  ]} />
);

const Texto = ({ c }) => <View style={s.marco}><Text style={s.cuerpo}>{c.texto}</Text></View>;

function Generico({ c }) {
  const campos = FORMATOS[c.formato]?.campos || Object.keys(c).filter((k) => k !== 'formato').map((k) => ({ clave: k, label: k }));
  return <Detalle c={{}} filas={campos.map((f) => [f.label, Array.isArray(c[f.clave]) ? c[f.clave].join(', ') : String(c[f.clave] ?? '')])} />;
}

const VISTAS = {
  correo: Correo, sms: Sms, mensaje_chat: Sms, sitio_web: SitioWeb, llamada: Llamada,
  detalle_remitente: DetalleRemitente, detalle_url: DetalleUrl, texto: Texto,
};

const s = StyleSheet.create({
  marco: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space(4), gap: space(2) },
  correoHeader: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontWeight: '700', fontSize: 18 },
  negrita: { fontWeight: '700', color: colors.text, fontSize: 15 },
  tenue: { color: colors.textMuted, fontSize: 13 },
  asunto: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: space(1) },
  cuerpo: { fontSize: 15, color: colors.text, lineHeight: 22 },
  botonFalso: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: space(3), alignItems: 'center', marginTop: space(1) },
  botonFalsoText: { color: '#FFFFFF', fontWeight: '700' },
  urlPie: { color: colors.textMuted, fontSize: 12 },
  burbuja: { backgroundColor: '#E5E7EB', borderRadius: 18, borderTopLeftRadius: 4, padding: space(3.5), marginTop: space(2), alignSelf: 'flex-start', maxWidth: '90%', gap: space(1) },
  enlaceTexto: { color: colors.primary, textDecorationLine: 'underline', fontSize: 15 },
  barraNavegador: { flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.neutralSoft, padding: space(3), borderBottomWidth: 1, borderColor: colors.border },
  candado: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  barraUrl: { flex: 1, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: space(3), paddingVertical: space(1.5), fontSize: 13, color: colors.text },
  etiquetaCampo: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  campoFalso: { height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: '#FAFAFA' },
  nota: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: space(3) },
});
