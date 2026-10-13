const { z } = require('zod');

const clave = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{2,40}$/, 'Usa de 2 a 40 caracteres: minúsculas, números o guion bajo');

const texto = (max, min = 1) => z.string().trim().min(min, 'Campo obligatorio').max(max, `Máximo ${max} caracteres`);

const TIPOS_ACCION = ['segura', 'neutral', 'riesgosa', 'critica'];
const FORMATOS = ['correo', 'sms', 'sitio_web', 'llamada', 'mensaje_chat', 'detalle_remitente', 'detalle_url', 'texto'];
const ESTADOS = ['borrador', 'activo', 'inactivo'];

// Contenido simulado de un paso: el formato decide cómo lo muestra la app.
// Los demás campos son libres (texto, booleano o lista corta de textos).
const contenidoPaso = z
  .object({ formato: z.enum(FORMATOS, 'Formato de contenido no válido') })
  .catchall(z.union([z.string().max(4000), z.boolean(), z.array(z.string().max(200)).max(20)]));

const senal = z.object({
  clave,
  descripcion: texto(200, 3),
  explicacion: texto(2000, 3),
});

const opcion = z.object({
  clave,
  texto: texto(300),
  tipo_accion: z.enum(TIPOS_ACCION, 'Tipo de acción no válido'),
  puntuacion: z.number().int().min(-100).max(100),
  retroalimentacion: texto(2000),
  siguiente_paso: clave.nullable().default(null),
  senales: z.array(clave).max(10).default([]),
});

const paso = z.object({
  clave,
  titulo: texto(150),
  pregunta: texto(500),
  es_inicial: z.boolean().default(false),
  contenido: contenidoPaso,
  opciones: z.array(opcion).min(2, 'Cada paso necesita al menos 2 opciones').max(8),
});

const reglaBase = {
  ajuste_puntuacion: z.number().int().min(-100).max(100).default(0),
  descripcion: texto(200, 3),
  retroalimentacion: z.string().trim().max(2000).nullable().optional(),
  activa: z.boolean().default(true),
};

const regla = z.discriminatedUnion('tipo_regla', [
  z.object({ tipo_regla: z.literal('OPCION_SELECCIONADA'), parametros: z.object({ opcion: clave }), ...reglaBase }),
  z.object({ tipo_regla: z.literal('TIPO_ACCION_PRESENTE'), parametros: z.object({ tipo_accion: z.enum(TIPOS_ACCION) }), ...reglaBase }),
  z.object({
    tipo_regla: z.literal('CONTEO_TIPO_ACCION'),
    parametros: z.object({ tipo_accion: z.enum(TIPOS_ACCION), minimo: z.number().int().min(1).max(20) }),
    ...reglaBase,
  }),
  z.object({ tipo_regla: z.literal('SECUENCIA'), parametros: z.object({ opciones: z.array(clave).min(2).max(5) }), ...reglaBase }),
], { error: 'Tipo de regla no válido' });

const escenarioDoc = z.object({
  titulo: texto(150, 3),
  tipo: clave,
  dificultad: clave,
  descripcion: texto(1000, 3),
  contenido: z.object({ contexto: z.string().trim().max(2000).optional() }).catchall(z.string().max(2000)).default({}),
  retroalimentacion_general: z.string().trim().max(2000).nullable().optional(),
  estado: z.enum(ESTADOS).default('borrador'),
  senales: z.array(senal).max(20).default([]),
  pasos: z.array(paso).min(1, 'El escenario necesita al menos un paso').max(20),
  reglas: z.array(regla).max(30).default([]),
});

const listQuery = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(50),
  buscar: z.string().trim().max(100).optional(),
  tipo: clave.optional(),
  dificultad: clave.optional(),
  estado: z.enum([...ESTADOS, 'eliminado']).optional(),
});

const patchSchema = z
  .object({ estado: z.enum(ESTADOS) })
  .strict();

module.exports = { escenarioDoc, listQuery, patchSchema, TIPOS_ACCION, FORMATOS, ESTADOS };
