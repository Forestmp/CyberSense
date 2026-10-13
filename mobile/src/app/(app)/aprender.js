import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Accordion } from '../../components/Accordion';
import { Alert, Button, Ionicons, Screen, Subtitle } from '../../components/ui';
import { colors, space, type } from '../../theme';

/*
 * Contenido educativo de referencia. No existe todavía un endpoint de
 * contenidos, así que se mantiene estático en el frontend.
 */
const TEMAS = [
  {
    icon: 'mail-outline', titulo: 'Phishing', resumen: 'Correos o sitios falsos que imitan a instituciones de confianza para robar datos o provocar una acción.',
    senales: [
      'El dominio del remitente no coincide con el oficial (p. ej. banco-seguridad.info en lugar de banco.mx).',
      'Urgencia o amenazas: «tu cuenta será bloqueada en 24 horas».',
      'Enlaces cuyo destino real no es el sitio oficial.',
      'Solicitud de contraseñas, NIP, códigos o datos de tarjeta.',
    ],
    hacer: ['Entra por la app o escribiendo tú mismo la dirección oficial.', 'Reporta el correo como phishing.', 'Ante la duda, llama al número oficial de la institución.'],
  },
  {
    icon: 'chatbubble-ellipses-outline', titulo: 'Smishing', resumen: 'Engaños por SMS o mensajería: paquetes retenidos, premios, cargos no reconocidos.',
    senales: [
      'Números desconocidos o remitentes genéricos.',
      'Enlaces acortados (bit.ly, etc.) que ocultan el destino.',
      'Pagos pequeños «para liberar» un paquete o premio.',
      'Errores de ortografía o mensajes impersonales.',
    ],
    hacer: ['No abras enlaces de mensajes inesperados.', 'Verifica en el sitio oficial de la paquetería o del banco.', 'Bloquea y reporta el número.'],
  },
  {
    icon: 'person-remove-outline', titulo: 'Suplantación de identidad', resumen: 'Alguien se hace pasar por una persona o institución de confianza: familiar, jefe, soporte técnico o banco.',
    senales: [
      'Cambios repentinos de número o de cuenta («perdí mi celular, este es mi nuevo número»).',
      'Peticiones urgentes de dinero o de códigos de verificación.',
      'Presión para mantener el secreto o no colgar.',
      'Datos que no coinciden con lo que conoces de esa persona.',
    ],
    hacer: ['Confirma por otro canal (llama al número que ya tenías).', 'Nunca compartas códigos de verificación.', 'Haz una pregunta que solo la persona real sabría.'],
  },
];

const REGLAS = [
  ['pause-circle-outline', 'Detente', 'La urgencia es la herramienta favorita de los atacantes.'],
  ['search-outline', 'Verifica', 'Revisa remitente, dirección web y canal antes de actuar.'],
  ['call-outline', 'Confirma', 'Usa un canal oficial que tú elijas, no el que te enviaron.'],
  ['megaphone-outline', 'Reporta', 'Reportar protege también a otras personas.'],
];

export default function Aprender() {
  const router = useRouter();
  return (
    <Screen>
      <Subtitle>Señales de alerta y buenas prácticas para reconocer ataques de ingeniería social.</Subtitle>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        {REGLAS.map(([icon, titulo, texto]) => (
          <View key={titulo} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: space(4), gap: space(1.5) }}>
            <Ionicons name={icon} size={22} color={colors.primary} />
            <Text style={type.h3}>{titulo}</Text>
            <Text style={type.small}>{texto}</Text>
          </View>
        ))}
      </View>

      {TEMAS.map((t, i) => (
        <Accordion key={t.titulo} icon={t.icon} title={t.titulo} defaultOpen={i === 0}>
          <Text style={type.body}>{t.resumen}</Text>
          <Text style={type.overline}>Señales de alerta</Text>
          {t.senales.map((s) => (
            <View key={s} style={{ flexDirection: 'row', gap: space(2.5) }}>
              <Ionicons name="flag" size={16} color={colors.warningText} style={{ marginTop: 3 }} />
              <Text style={[type.body, { flex: 1 }]}>{s}</Text>
            </View>
          ))}
          <Text style={type.overline}>Qué hacer</Text>
          {t.hacer.map((s) => (
            <View key={s} style={{ flexDirection: 'row', gap: space(2.5) }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 3 }} />
              <Text style={[type.body, { flex: 1 }]}>{s}</Text>
            </View>
          ))}
        </Accordion>
      ))}

      <Alert tone="info" title="Pon a prueba lo aprendido" message="Las simulaciones de CyberSense te permiten practicar en un entorno seguro." />
      <Button title="Ir a simulaciones" icon="play" onPress={() => router.push('/simulaciones')} />
    </Screen>
  );
}
