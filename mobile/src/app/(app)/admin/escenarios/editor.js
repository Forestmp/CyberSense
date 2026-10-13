import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../../api/client';
import { Alert, Button, Card, ErrorState, Ionicons, Loading, Segmented, TextField } from '../../../../components/ui';
import { useFeedback } from '../../../../context/FeedbackContext';
import { TIPOS_ACCION } from '../../../../lib/etiquetas';
import { FORMATOS } from '../../../../lib/formatos';
import { colors, radius, shadow, space, type } from '../../../../theme';

/*
 * Editor de escenarios (crear y editar). El estado local tiene la misma forma
 * que el documento de la API (referencias por clave); `_k` es solo una llave
 * de React. Números y listas se guardan como texto mientras se editan.
 */

let contador = 0;
const k = () => `k${++contador}`;
const clonar = (x) => JSON.parse(JSON.stringify(x));

const nuevaOpcion = (clave) => ({
  _k: k(), clave, texto: '', tipo_accion: 'neutral', puntuacion: '0', retroalimentacion: '', siguiente_paso: null, senales: [],
});
const nuevoPaso = (clave, inicial) => ({
  _k: k(), clave, titulo: '', pregunta: '¿Qué haces?', es_inicial: inicial, contenido: { formato: 'correo' },
  opciones: [nuevaOpcion(`${clave}_op1`), nuevaOpcion(`${clave}_op2`)],
});
const nuevaRegla = () => ({
  _k: k(), tipo_regla: 'TIPO_ACCION_PRESENTE', parametros: { tipo_accion: 'critica' }, ajuste_puntuacion: '0',
  descripcion: '', retroalimentacion: '', activa: true,
});

const VACIO = {
  titulo: '', tipo: 'phishing', dificultad: 'basico', descripcion: '', contexto: '', retroalimentacion_general: '',
  estado: 'borrador', senales: [], pasos: [nuevoPaso('paso_1', true)], reglas: [],
};

/** Documento de la API → estado del editor. */
function aEstado(e) {
  return {
    titulo: e.titulo, tipo: e.tipo, dificultad: e.dificultad, descripcion: e.descripcion,
    contexto: e.contenido?.contexto || '', retroalimentacion_general: e.retroalimentacion_general || '',
    estado: e.estado === 'eliminado' ? 'inactivo' : e.estado,
    senales: e.senales.map((s) => ({ _k: k(), clave: s.clave, descripcion: s.descripcion, explicacion: s.explicacion })),
    pasos: e.pasos.map((p) => ({
      _k: k(), clave: p.clave, titulo: p.titulo, pregunta: p.pregunta, es_inicial: p.es_inicial,
      contenido: Object.fromEntries(Object.entries(p.contenido).map(([c, v]) => [c, Array.isArray(v) ? v.join(', ') : v])),
      opciones: p.opciones.map((o) => ({
        _k: k(), clave: o.clave, texto: o.texto, tipo_accion: o.tipo_accion, puntuacion: String(o.puntuacion),
        retroalimentacion: o.retroalimentacion, siguiente_paso: o.siguiente_paso, senales: o.senales,
      })),
    })),
    reglas: e.reglas.map((r) => ({
      _k: k(), tipo_regla: r.tipo_regla,
      parametros: r.tipo_regla === 'SECUENCIA' ? { opciones: (r.parametros.opciones || []).join(', ') }
        : r.tipo_regla === 'CONTEO_TIPO_ACCION' ? { ...r.parametros, minimo: String(r.parametros.minimo) } : r.parametros,
      ajuste_puntuacion: String(r.ajuste_puntuacion), descripcion: r.descripcion, retroalimentacion: r.retroalimentacion || '', activa: r.activa,
    })),
  };
}

/** Estado del editor → payload de la API. Devuelve { payload, errores }. */
function aPayload(d) {
  const errores = [];
  const entero = (v, donde) => {
    const n = Number(String(v).trim());
    if (String(v).trim() === '' || !Number.isInteger(n)) errores.push(`${donde}: debe ser un número entero`);
    return n;
  };
  const camposDe = (formato) => FORMATOS[formato]?.campos || [];

  const payload = {
    titulo: d.titulo, tipo: d.tipo, dificultad: d.dificultad, descripcion: d.descripcion, estado: d.estado,
    contenido: d.contexto.trim() ? { contexto: d.contexto.trim() } : {},
    retroalimentacion_general: d.retroalimentacion_general.trim() || null,
    senales: d.senales.map(({ _k, ...s }) => s), // eslint-disable-line no-unused-vars
    pasos: d.pasos.map((p) => {
      const contenido = { formato: p.contenido.formato };
      for (const campo of camposDe(p.contenido.formato)) {
        const v = p.contenido[campo.clave];
        if (campo.tipo === 'booleano') { if (typeof v === 'boolean') contenido[campo.clave] = v; continue; }
        if (v == null || String(v).trim() === '') continue;
        contenido[campo.clave] = campo.tipo === 'lista' ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : String(v);
      }
      return {
        clave: p.clave, titulo: p.titulo, pregunta: p.pregunta, es_inicial: p.es_inicial, contenido,
        opciones: p.opciones.map((o) => ({
          clave: o.clave, texto: o.texto, tipo_accion: o.tipo_accion, retroalimentacion: o.retroalimentacion,
          puntuacion: entero(o.puntuacion, `Puntuación de «${o.texto || o.clave}»`),
          siguiente_paso: o.siguiente_paso || null, senales: o.senales,
        })),
      };
    }),
    reglas: d.reglas.map((r) => {
      let parametros = r.parametros;
      if (r.tipo_regla === 'SECUENCIA') parametros = { opciones: String(r.parametros.opciones || '').split(',').map((x) => x.trim()).filter(Boolean) };
      if (r.tipo_regla === 'CONTEO_TIPO_ACCION') parametros = { tipo_accion: r.parametros.tipo_accion, minimo: entero(r.parametros.minimo, `Mínimo de «${r.descripcion}»`) };
      return {
        tipo_regla: r.tipo_regla, parametros, descripcion: r.descripcion, activa: r.activa,
        ajuste_puntuacion: entero(r.ajuste_puntuacion, `Ajuste de «${r.descripcion || r.tipo_regla}»`),
        retroalimentacion: r.retroalimentacion.trim() || null,
      };
    }),
  };
  return { payload, errores };
}

const TIPO_ACCION_OPTS = Object.entries(TIPOS_ACCION).map(([value, t]) => ({ value, label: t.label }));
const TIPOS_REGLA = [
  { value: 'TIPO_ACCION_PRESENTE', label: 'Tipo de acción presente' },
  { value: 'CONTEO_TIPO_ACCION', label: 'Conteo de acciones' },
  { value: 'OPCION_SELECCIONADA', label: 'Opción elegida' },
  { value: 'SECUENCIA', label: 'Secuencia' },
];
const PARAMS_INICIALES = {
  TIPO_ACCION_PRESENTE: { tipo_accion: 'critica' },
  CONTEO_TIPO_ACCION: { tipo_accion: 'riesgosa', minimo: '2' },
  OPCION_SELECCIONADA: { opcion: '' },
  SECUENCIA: { opciones: '' },
};

function Encabezado({ titulo, icon, children }) {
  return (
    <View style={styles.encabezado}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flex: 1 }}>
        {icon ? <View style={styles.encIcono}><Ionicons name={icon} size={18} color={colors.primary} /></View> : null}
        <Text style={styles.seccion}>{titulo}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space(2) }}>{children}</View>
    </View>
  );
}

export default function EditorEscenario() {
  const { id } = useLocalSearchParams();
  const esNuevo = !id;
  const router = useRouter();
  const { toast } = useFeedback();
  const scrollRef = useRef(null);
  const [doc, setDoc] = useState(esNuevo ? clonar(VACIO) : null);
  const [catalogos, setCatalogos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api('/catalogos').then(setCatalogos).catch((e) => setErrores([e.message]));
    if (!esNuevo) {
      api(`/scenarios/${id}`).then(({ escenario }) => setDoc(aEstado(escenario))).catch((e) => setErrores([e.message]));
    }
  }, [id, esNuevo]);

  if (!doc || !catalogos) {
    return errores.length ? <ErrorState message={`No fue posible cargar el escenario. ${errores[0]}`} onRetry={() => router.back()} /> : <Loading />;
  }

  // Aplica una modificación sobre una copia del documento.
  const upd = (fn) => setDoc((d) => { const c = clonar(d); fn(c); return c; });
  const todasLasOpciones = doc.pasos.flatMap((p) => p.opciones);
  const claveUnica = (base, existentes) => {
    let n = existentes.length + 1;
    while (existentes.includes(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
  };

  // Renombrar una clave actualiza las referencias que dependen de ella.
  const renombrarPaso = (pi, nueva) => upd((d) => {
    const vieja = d.pasos[pi].clave;
    d.pasos[pi].clave = nueva;
    d.pasos.forEach((p) => p.opciones.forEach((o) => { if (o.siguiente_paso === vieja) o.siguiente_paso = nueva; }));
  });
  const renombrarSenal = (si, nueva) => upd((d) => {
    const vieja = d.senales[si].clave;
    d.senales[si].clave = nueva;
    d.pasos.forEach((p) => p.opciones.forEach((o) => { o.senales = o.senales.map((s) => (s === vieja ? nueva : s)); }));
  });
  const renombrarOpcion = (pi, oi, nueva) => upd((d) => {
    const vieja = d.pasos[pi].opciones[oi].clave;
    d.pasos[pi].opciones[oi].clave = nueva;
    d.reglas.forEach((r) => {
      if (r.tipo_regla === 'OPCION_SELECCIONADA' && r.parametros.opcion === vieja) r.parametros.opcion = nueva;
    });
  });

  async function guardar() {
    const { payload, errores: locales } = aPayload(doc);
    if (locales.length) {
      setErrores(locales);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrores([]);
    setGuardando(true);
    try {
      const { escenario } = esNuevo
        ? await api('/scenarios', { method: 'POST', body: payload })
        : await api(`/scenarios/${id}`, { method: 'PUT', body: payload });
      toast.exito(`Escenario guardado correctamente (${escenario.codigo})`);
      router.replace(`/admin/escenarios/${escenario.id}`);
    } catch (e) {
      const detalle = Array.isArray(e.details)
        ? e.details.map((x) => (x.campo && x.campo !== 'body' ? `${x.campo.replace(/^body\./, '')}: ${x.mensaje}` : x.mensaje))
        : [];
      setErrores([e.message, ...detalle]);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setGuardando(false);
    }
  }

  const ListaErrores = () => (errores.length ? (
    <Alert tone="error" title={errores[0]}>
      {errores.slice(1).map((m, i) => <Text key={i} style={[type.small, { color: '#7F1D1D' }]}>• {m}</Text>)}
    </Alert>
  ) : null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Stack.Screen options={{ title: esNuevo ? 'Nuevo escenario' : 'Editar escenario' }} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <ListaErrores />

        {/* ---------- Datos generales ---------- */}
        <Alert tone="info" message="Todo el contenido debe ser ficticio: usa instituciones, dominios y números inventados." />
        <Encabezado titulo="Datos generales" icon="document-text-outline" />
        <Card style={styles.bloque}>
          <TextField label="Título" value={doc.titulo} onChangeText={(v) => upd((d) => { d.titulo = v; })} />
          <Segmented label="Tipo de ataque" value={doc.tipo} onChange={(v) => upd((d) => { d.tipo = v; })}
            options={catalogos.tipos_ataque.map((t) => ({ value: t.clave, label: t.nombre }))} />
          <Segmented label="Dificultad" value={doc.dificultad} onChange={(v) => upd((d) => { d.dificultad = v; })}
            options={catalogos.dificultades.map((t) => ({ value: t.clave, label: t.nombre }))} />
          <TextField label="Descripción (la ve el usuario)" multiline value={doc.descripcion} onChangeText={(v) => upd((d) => { d.descripcion = v; })} />
          <TextField label="Contexto de la situación" multiline value={doc.contexto} onChangeText={(v) => upd((d) => { d.contexto = v; })}
            hint="Se muestra antes de comenzar. Usa nombres de instituciones ficticias." />
          <TextField label="Retroalimentación general" multiline value={doc.retroalimentacion_general}
            onChangeText={(v) => upd((d) => { d.retroalimentacion_general = v; })} hint="Se muestra al final como recomendación." />
          <Segmented label="Estado" value={doc.estado} onChange={(v) => upd((d) => { d.estado = v; })}
            options={[{ value: 'borrador', label: 'Borrador' }, { value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
        </Card>

        {/* ---------- Señales de alerta ---------- */}
        <Encabezado titulo={`Señales de alerta (${doc.senales.length})`} icon='flag-outline'>
          <Button small title="+ Señal" variant="secondary"
            onPress={() => upd((d) => { d.senales.push({ _k: k(), clave: claveUnica('senal', d.senales.map((s) => s.clave)), descripcion: '', explicacion: '' }); })} />
        </Encabezado>
        {doc.senales.map((s, si) => (
          <Card key={s._k} style={styles.bloque}>
            <TextField label="Clave" value={s.clave} autoCapitalize="none" onChangeText={(v) => renombrarSenal(si, v)} />
            <TextField label="Descripción" value={s.descripcion} onChangeText={(v) => upd((d) => { d.senales[si].descripcion = v; })} />
            <TextField label="Explicación (al final)" multiline value={s.explicacion} onChangeText={(v) => upd((d) => { d.senales[si].explicacion = v; })} />
            <Button small title="Quitar señal" variant="danger" onPress={() => upd((d) => {
              const clave = d.senales[si].clave;
              d.senales.splice(si, 1);
              d.pasos.forEach((p) => p.opciones.forEach((o) => { o.senales = o.senales.filter((x) => x !== clave); }));
            })} />
          </Card>
        ))}

        {/* ---------- Pasos ---------- */}
        <Encabezado titulo={`Pasos y opciones (${doc.pasos.length})`} icon='git-branch-outline'>
          <Button small title="+ Paso" variant="secondary"
            onPress={() => upd((d) => { d.pasos.push(nuevoPaso(claveUnica('paso', d.pasos.map((p) => p.clave)), d.pasos.length === 0)); })} />
        </Encabezado>
        {doc.pasos.map((p, pi) => (
          <Card key={p._k} style={[styles.bloque, p.es_inicial && { borderColor: colors.primary, borderWidth: 2 }]}>
            <View style={styles.encabezado}>
              <Text style={styles.subseccion}>Paso {pi + 1}{p.es_inicial ? ' · inicial' : ''}</Text>
              {!p.es_inicial ? (
                <Button small title="Marcar inicial" variant="ghost" onPress={() => upd((d) => { d.pasos.forEach((x, i) => { x.es_inicial = i === pi; }); })} />
              ) : null}
            </View>
            <TextField label="Clave" value={p.clave} autoCapitalize="none" onChangeText={(v) => renombrarPaso(pi, v)} />
            <TextField label="Título" value={p.titulo} onChangeText={(v) => upd((d) => { d.pasos[pi].titulo = v; })} />
            <Segmented label="Formato del contenido" value={p.contenido.formato}
              onChange={(v) => upd((d) => { d.pasos[pi].contenido.formato = v; })}
              options={Object.entries(FORMATOS).map(([value, f]) => ({ value, label: f.label }))} />
            {FORMATOS[p.contenido.formato].campos.map((campo) => (campo.tipo === 'booleano' ? (
              <Segmented key={campo.clave} label={campo.label} value={p.contenido[campo.clave] ?? null}
                onChange={(v) => upd((d) => { d.pasos[pi].contenido[campo.clave] = v; })}
                options={[{ value: true, label: 'Sí' }, { value: false, label: 'No' }]} />
            ) : (
              <TextField key={campo.clave} label={campo.label} multiline={campo.tipo === 'multilinea'} autoCapitalize="none"
                value={String(p.contenido[campo.clave] ?? '')}
                onChangeText={(v) => upd((d) => { d.pasos[pi].contenido[campo.clave] = v; })} />
            )))}
            <TextField label="Pregunta" value={p.pregunta} onChangeText={(v) => upd((d) => { d.pasos[pi].pregunta = v; })} />

            {p.opciones.map((o, oi) => (
              <View key={o._k} style={[styles.opcion, { borderColor: TIPOS_ACCION[o.tipo_accion].fg }]}>
                <Text style={styles.subseccion}>Opción {oi + 1}</Text>
                <TextField label="Texto" value={o.texto} onChangeText={(v) => upd((d) => { d.pasos[pi].opciones[oi].texto = v; })} />
                <TextField label="Clave" value={o.clave} autoCapitalize="none" onChangeText={(v) => renombrarOpcion(pi, oi, v)} />
                <Segmented label="Tipo de acción" value={o.tipo_accion} options={TIPO_ACCION_OPTS}
                  onChange={(v) => upd((d) => { d.pasos[pi].opciones[oi].tipo_accion = v; })} />
                <TextField label="Puntuación" value={o.puntuacion} keyboardType="numbers-and-punctuation"
                  hint="Positiva = segura; negativa = riesgosa" onChangeText={(v) => upd((d) => { d.pasos[pi].opciones[oi].puntuacion = v; })} />
                <TextField label="Retroalimentación (al final)" multiline value={o.retroalimentacion}
                  onChangeText={(v) => upd((d) => { d.pasos[pi].opciones[oi].retroalimentacion = v; })} />
                <Segmented label="Después de elegirla" value={o.siguiente_paso}
                  onChange={(v) => upd((d) => { d.pasos[pi].opciones[oi].siguiente_paso = v; })}
                  options={[{ value: null, label: 'Termina' }, ...doc.pasos.filter((x) => x.clave !== p.clave).map((x) => ({ value: x.clave, label: `→ ${x.titulo || x.clave}` }))]} />
                {doc.senales.length ? (
                  <View style={{ gap: space(1.5) }}>
                    <Text style={styles.label}>Señales que identifica</Text>
                    <View style={styles.chips}>
                      {doc.senales.map((s) => {
                        const activa = o.senales.includes(s.clave);
                        return (
                          <Button key={s._k} small title={`${activa ? '✓ ' : ''}${s.descripcion || s.clave}`} variant={activa ? 'primary' : 'secondary'}
                            onPress={() => upd((d) => {
                              const lista = d.pasos[pi].opciones[oi].senales;
                              d.pasos[pi].opciones[oi].senales = activa ? lista.filter((x) => x !== s.clave) : [...lista, s.clave];
                            })} />
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                {p.opciones.length > 2 ? (
                  <Button small title="Quitar opción" variant="ghost" onPress={() => upd((d) => { d.pasos[pi].opciones.splice(oi, 1); })} />
                ) : null}
              </View>
            ))}
            <Button small title="+ Opción" variant="secondary"
              onPress={() => upd((d) => { d.pasos[pi].opciones.push(nuevaOpcion(claveUnica(`${p.clave}_op`, todasLasOpciones.map((x) => x.clave)))); })} />
            {doc.pasos.length > 1 ? (
              <Button small title="Quitar paso" variant="danger" onPress={() => upd((d) => {
                const clave = d.pasos[pi].clave;
                const eraInicial = d.pasos[pi].es_inicial;
                d.pasos.splice(pi, 1);
                d.pasos.forEach((x) => x.opciones.forEach((o2) => { if (o2.siguiente_paso === clave) o2.siguiente_paso = null; }));
                if (eraInicial) d.pasos[0].es_inicial = true;
              })} />
            ) : null}
          </Card>
        ))}

        {/* ---------- Reglas ---------- */}
        <Encabezado titulo={`Reglas de evaluación (${doc.reglas.length})`} icon='options-outline'>
          <Button small title="+ Regla" variant="secondary" onPress={() => upd((d) => { d.reglas.push(nuevaRegla()); })} />
        </Encabezado>
        {doc.reglas.map((r, ri) => (
          <Card key={r._k} style={styles.bloque}>
            <Segmented label="Condición" value={r.tipo_regla} options={TIPOS_REGLA}
              onChange={(v) => upd((d) => { d.reglas[ri].tipo_regla = v; d.reglas[ri].parametros = clonar(PARAMS_INICIALES[v]); })} />
            {r.tipo_regla === 'TIPO_ACCION_PRESENTE' || r.tipo_regla === 'CONTEO_TIPO_ACCION' ? (
              <Segmented label="Tipo de acción" value={r.parametros.tipo_accion} options={TIPO_ACCION_OPTS}
                onChange={(v) => upd((d) => { d.reglas[ri].parametros.tipo_accion = v; })} />
            ) : null}
            {r.tipo_regla === 'CONTEO_TIPO_ACCION' ? (
              <TextField label="Mínimo de veces" value={String(r.parametros.minimo ?? '')} keyboardType="number-pad"
                onChangeText={(v) => upd((d) => { d.reglas[ri].parametros.minimo = v; })} />
            ) : null}
            {r.tipo_regla === 'OPCION_SELECCIONADA' ? (
              <Segmented label="Opción" value={r.parametros.opcion}
                onChange={(v) => upd((d) => { d.reglas[ri].parametros.opcion = v; })}
                options={todasLasOpciones.map((o) => ({ value: o.clave, label: o.texto || o.clave }))} />
            ) : null}
            {r.tipo_regla === 'SECUENCIA' ? (
              <TextField label="Claves de opciones en orden (separadas por comas)" autoCapitalize="none" value={String(r.parametros.opciones ?? '')}
                hint={`Disponibles: ${todasLasOpciones.map((o) => o.clave).join(', ')}`}
                onChangeText={(v) => upd((d) => { d.reglas[ri].parametros.opciones = v; })} />
            ) : null}
            <TextField label="Ajuste de puntuación" value={r.ajuste_puntuacion} keyboardType="numbers-and-punctuation"
              onChangeText={(v) => upd((d) => { d.reglas[ri].ajuste_puntuacion = v; })} />
            <TextField label="Descripción" value={r.descripcion} onChangeText={(v) => upd((d) => { d.reglas[ri].descripcion = v; })} />
            <TextField label="Retroalimentación" multiline value={r.retroalimentacion} onChangeText={(v) => upd((d) => { d.reglas[ri].retroalimentacion = v; })} />
            <Segmented label="Activa" value={r.activa} options={[{ value: true, label: 'Sí' }, { value: false, label: 'No' }]}
              onChange={(v) => upd((d) => { d.reglas[ri].activa = v; })} />
            <Button small title="Quitar regla" variant="danger" onPress={() => upd((d) => { d.reglas.splice(ri, 1); })} />
          </Card>
        ))}

        <ListaErrores />
      </ScrollView>
      <View style={[styles.barraGuardar, shadow.lg]}>
        <View style={styles.barraInterior}>
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title={esNuevo ? 'Crear escenario' : 'Guardar cambios'} icon="save-outline" onPress={guardar} loading={guardando} style={{ flex: 2 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: space(5), gap: space(4), width: '100%', maxWidth: 720, alignSelf: 'center' },
  bloque: { gap: space(3) },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2), marginTop: space(2) },
  seccion: type.h2,
  subseccion: type.overline,
  label: type.label,
  encIcono: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  barraGuardar: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, padding: space(3) },
  barraInterior: { flexDirection: 'row', gap: space(3), width: '100%', maxWidth: 720, alignSelf: 'center' },
  opcion: { borderLeftWidth: 3, paddingLeft: space(3), gap: space(3), paddingVertical: space(2), borderRadius: radius.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
