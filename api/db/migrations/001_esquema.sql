-- =============================================================================
-- 001 · Esquema de la base de datos (21 tablas)
-- CyberSense · TT ESCOM-IPN 2027-A087
-- Corresponde al modelo de datos del documento técnico (sección 5.4.2).
-- =============================================================================

-- Mantiene actualizada la columna fecha_actualizacion.
CREATE OR REPLACE FUNCTION fn_set_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Usuarios y acceso
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                 VARCHAR(100),
  correo                 VARCHAR(254),
  password_hash          TEXT         NOT NULL,
  rol                    VARCHAR(20)  NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'administrador')),
  estado                 VARCHAR(20)  NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'inactiva', 'eliminada')),  -- RN-32
  token_version          INTEGER      NOT NULL DEFAULT 0,          -- RN-19
  fecha_registro         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_aceptacion_aviso TIMESTAMPTZ,                              -- RN-23
  fecha_actualizacion    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_eliminacion      TIMESTAMPTZ,
  fecha_anonimizacion    TIMESTAMPTZ,                              -- RN-24
  -- Nombre y correo solo pueden faltar en una cuenta anonimizada.
  CHECK (fecha_anonimizacion IS NOT NULL OR (nombre IS NOT NULL AND correo IS NOT NULL)),
  CHECK ((estado = 'eliminada') = (fecha_eliminacion IS NOT NULL))
);
CREATE UNIQUE INDEX ux_usuarios_correo ON usuarios (lower(correo));   -- RN-15
CREATE INDEX ix_usuarios_estado_rol ON usuarios (estado, rol);
CREATE TRIGGER trg_usuarios_actualizacion BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_fecha_actualizacion();

-- Códigos de recuperación de contraseña (RN-16). Solo se guarda un HMAC del código.
CREATE TABLE recuperaciones_password (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  codigo_hash TEXT        NOT NULL,
  intentos    SMALLINT    NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 5),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ
);
CREATE INDEX ix_recuperaciones_usuario ON recuperaciones_password (usuario_id, creado_en DESC);

-- -----------------------------------------------------------------------------
-- Catálogos
-- -----------------------------------------------------------------------------
CREATE TABLE tipos_ataque (
  id             SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave          VARCHAR(40) NOT NULL UNIQUE,     -- phishing, smishing
  nombre         VARCHAR(80) NOT NULL,
  prefijo_codigo VARCHAR(4)  NOT NULL UNIQUE,     -- PH, SM → códigos PH-001
  descripcion    TEXT
);

-- Unidad con la que el modelo de regresión estima la probabilidad de error (RN-07).
CREATE TABLE subcategorias (
  id             SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_ataque_id SMALLINT     NOT NULL REFERENCES tipos_ataque (id),
  clave          VARCHAR(60)  NOT NULL UNIQUE,
  nombre         VARCHAR(120) NOT NULL,
  descripcion    TEXT
);
CREATE INDEX ix_subcategorias_tipo ON subcategorias (tipo_ataque_id);

CREATE TABLE niveles_dificultad (
  id     SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave  VARCHAR(20) NOT NULL UNIQUE,             -- basico, intermedio, avanzado
  nombre VARCHAR(40) NOT NULL,
  valor  SMALLINT    NOT NULL UNIQUE              -- 1, 2, 3 (RN-08 a RN-11)
);

-- Rangos configurables y versionados para el nivel de vulnerabilidad (RN-27).
CREATE TABLE rangos_vulnerabilidad (
  id            SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version       VARCHAR(20)  NOT NULL,
  nivel         VARCHAR(20)  NOT NULL CHECK (nivel IN ('bajo', 'medio', 'alto', 'critico')),
  nombre        VARCHAR(40)  NOT NULL,
  puntaje_min   NUMERIC(5,2) NOT NULL CHECK (puntaje_min BETWEEN 0 AND 100),
  puntaje_max   NUMERIC(5,2) NOT NULL CHECK (puntaje_max BETWEEN 0 AND 100),
  descripcion   TEXT,
  recomendacion TEXT,
  activo        BOOLEAN      NOT NULL DEFAULT false,
  CHECK (puntaje_min <= puntaje_max),
  UNIQUE (version, nivel)
);

-- -----------------------------------------------------------------------------
-- Escenarios
-- -----------------------------------------------------------------------------
CREATE TABLE escenarios (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                    VARCHAR(20)  NOT NULL UNIQUE,
  titulo                    VARCHAR(150) NOT NULL,
  descripcion               TEXT         NOT NULL,
  subcategoria_id           SMALLINT     NOT NULL REFERENCES subcategorias (id),
  dificultad_id             SMALLINT     NOT NULL REFERENCES niveles_dificultad (id),   -- RN-31
  contenido                 JSONB,
  retroalimentacion_general TEXT,
  estado                    VARCHAR(20)  NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador', 'activo', 'inactivo', 'eliminado')),
  creado_por                BIGINT       REFERENCES usuarios (id) ON DELETE SET NULL,
  fecha_creacion            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_actualizacion       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_escenarios_subcategoria_estado ON escenarios (subcategoria_id, estado);
CREATE TRIGGER trg_escenarios_actualizacion BEFORE UPDATE ON escenarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_fecha_actualizacion();

CREATE TABLE escenario_pasos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escenario_id BIGINT       NOT NULL REFERENCES escenarios (id) ON DELETE CASCADE,
  clave        VARCHAR(40)  NOT NULL,
  orden        SMALLINT     NOT NULL,
  titulo       VARCHAR(150) NOT NULL,
  pregunta     TEXT         NOT NULL,
  contenido    JSONB        NOT NULL,        -- {formato: 'correo'|'sms'|'chat'|'sitio_web', ...}
  es_inicial   BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE (escenario_id, clave),
  UNIQUE (escenario_id, orden)
);
CREATE UNIQUE INDEX ux_pasos_inicial ON escenario_pasos (escenario_id) WHERE es_inicial;   -- RN-20

CREATE TABLE senales_alerta (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escenario_id BIGINT       NOT NULL REFERENCES escenarios (id) ON DELETE CASCADE,
  clave        VARCHAR(40)  NOT NULL,
  orden        SMALLINT     NOT NULL,
  descripcion  VARCHAR(200) NOT NULL,
  explicacion  TEXT         NOT NULL,
  UNIQUE (escenario_id, clave)
);

CREATE TABLE opciones (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paso_id           BIGINT       NOT NULL REFERENCES escenario_pasos (id) ON DELETE CASCADE,
  clave             VARCHAR(40)  NOT NULL,   -- única dentro del escenario (se valida en la API)
  orden             SMALLINT     NOT NULL,
  texto             VARCHAR(300) NOT NULL,
  -- RN-03, RN-04: critica −25, riesgosa −10, mejorable −5, neutral y segura 0
  tipo_accion       VARCHAR(20)  NOT NULL
                    CHECK (tipo_accion IN ('segura', 'neutral', 'mejorable', 'riesgosa', 'critica')),
  puntuacion        INTEGER      NOT NULL,   -- solo ordena la ruta más segura
  retroalimentacion TEXT         NOT NULL,   -- se muestra al terminar (RN-12)
  siguiente_paso_id BIGINT       REFERENCES escenario_pasos (id) ON DELETE SET NULL,   -- NULL = fin
  UNIQUE (paso_id, clave),
  UNIQUE (paso_id, orden)
);
CREATE INDEX ix_opciones_siguiente_paso ON opciones (siguiente_paso_id);

CREATE TABLE opcion_senal (
  opcion_id BIGINT NOT NULL REFERENCES opciones (id) ON DELETE CASCADE,
  senal_id  BIGINT NOT NULL REFERENCES senales_alerta (id) ON DELETE CASCADE,
  PRIMARY KEY (opcion_id, senal_id)
);
CREATE INDEX ix_opcion_senal_senal ON opcion_senal (senal_id);

-- Reglas deterministas del motor de evaluación. escenario_id NULL = regla global.
--   OPCION_SELECCIONADA   {"opcion": "<clave>"}
--   TIPO_ACCION_PRESENTE  {"tipo_accion": "critica"}
--   CONTEO_TIPO_ACCION    {"tipo_accion": "riesgosa", "minimo": 2}
--   SECUENCIA             {"opciones": ["<clave1>", "<clave2>"]}
CREATE TABLE reglas_evaluacion (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escenario_id      BIGINT       REFERENCES escenarios (id) ON DELETE CASCADE,
  tipo_regla        VARCHAR(30)  NOT NULL
                    CHECK (tipo_regla IN ('OPCION_SELECCIONADA', 'TIPO_ACCION_PRESENTE', 'CONTEO_TIPO_ACCION', 'SECUENCIA')),
  parametros        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ajuste_puntuacion INTEGER      NOT NULL DEFAULT 0 CHECK (ajuste_puntuacion BETWEEN -10 AND 10),   -- RN-03
  descripcion       VARCHAR(200) NOT NULL,
  retroalimentacion TEXT,
  activa            BOOLEAN      NOT NULL DEFAULT true,
  prioridad         SMALLINT     NOT NULL DEFAULT 0
);
CREATE INDEX ix_reglas_escenario ON reglas_evaluacion (escenario_id) WHERE activa;

-- -----------------------------------------------------------------------------
-- Simulación y resultados
-- -----------------------------------------------------------------------------
CREATE TABLE intentos (
  id                              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id                      BIGINT       NOT NULL REFERENCES usuarios (id),
  escenario_id                    BIGINT       NOT NULL REFERENCES escenarios (id),
  numero_intento                  INTEGER      NOT NULL,
  estado                          VARCHAR(20)  NOT NULL DEFAULT 'en_curso'
                                  CHECK (estado IN ('en_curso', 'finalizado', 'abandonado')),   -- RN-21
  paso_actual_id                  BIGINT       REFERENCES escenario_pasos (id) ON DELETE SET NULL,
  fecha_inicio                    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_fin                       TIMESTAMPTZ,
  duracion_ms                     INTEGER      CHECK (duracion_ms >= 0),
  puntaje                         NUMERIC(5,2) CHECK (puntaje BETWEEN 0 AND 100),
  es_vulnerable                   BOOLEAN,                                                     -- RN-05
  nivel_vulnerabilidad            VARCHAR(20)  CHECK (nivel_vulnerabilidad IN ('bajo', 'medio', 'alto', 'critico')),
  aciertos                        SMALLINT,
  errores                         SMALLINT,
  senales_detectadas              SMALLINT,
  senales_totales                 SMALLINT,
  resultado                       JSONB,
  version_rangos                  VARCHAR(20),
  retroalimentacion_confirmada_en TIMESTAMPTZ,                                                 -- RN-13
  UNIQUE (usuario_id, escenario_id, numero_intento)
);
CREATE INDEX ix_intentos_usuario_fecha ON intentos (usuario_id, fecha_inicio DESC);
CREATE INDEX ix_intentos_escenario ON intentos (escenario_id);
-- Un solo intento en curso por usuario (RN-29).
CREATE UNIQUE INDEX ux_intentos_en_curso ON intentos (usuario_id) WHERE estado = 'en_curso';
-- Intento finalizado pendiente de confirmar la retroalimentación (RN-13).
CREATE INDEX ix_intentos_retro_pendiente ON intentos (usuario_id)
  WHERE estado = 'finalizado' AND retroalimentacion_confirmada_en IS NULL;

-- Cada decisión, con copia de la opción elegida (RN-18).
CREATE TABLE respuestas_usuario (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intento_id          BIGINT       NOT NULL REFERENCES intentos (id) ON DELETE CASCADE,
  paso_id             BIGINT       REFERENCES escenario_pasos (id) ON DELETE SET NULL,
  opcion_id           BIGINT       REFERENCES opciones (id) ON DELETE SET NULL,
  orden               SMALLINT     NOT NULL,
  opcion_clave        VARCHAR(40)  NOT NULL,
  texto_opcion        VARCHAR(300) NOT NULL,
  tipo_accion         VARCHAR(20)  NOT NULL,
  tiempo_respuesta_ms INTEGER      CHECK (tiempo_respuesta_ms >= 0),
  fecha_respuesta     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (intento_id, orden)
);

-- Resumen por usuario y subcategoría; se recalcula al finalizar cada intento.
CREATE TABLE metricas_usuario (
  usuario_id           BIGINT       NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  subcategoria_id      SMALLINT     NOT NULL REFERENCES subcategorias (id),
  total_intentos       INTEGER      NOT NULL DEFAULT 0,
  aciertos             INTEGER      NOT NULL DEFAULT 0,
  errores              INTEGER      NOT NULL DEFAULT 0,
  puntaje_promedio     NUMERIC(5,2),
  ultimo_puntaje       NUMERIC(5,2),
  nivel_vulnerabilidad VARCHAR(20)  CHECK (nivel_vulnerabilidad IN ('bajo', 'medio', 'alto', 'critico')),
  ultima_actualizacion TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, subcategoria_id)
);

-- -----------------------------------------------------------------------------
-- Diagnóstico y predicción
-- -----------------------------------------------------------------------------
CREATE TABLE examenes_diagnostico (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id   BIGINT      NOT NULL UNIQUE REFERENCES usuarios (id) ON DELETE CASCADE,   -- RN-22
  estado       VARCHAR(20) NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'finalizado')),
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_fin    TIMESTAMPTZ
);

CREATE TABLE preguntas_diagnostico (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subcategoria_id SMALLINT    NOT NULL REFERENCES subcategorias (id),
  orden           SMALLINT    NOT NULL,
  enunciado       TEXT        NOT NULL,
  contenido       JSONB,
  activa          BOOLEAN     NOT NULL DEFAULT true
);
-- Una sola pregunta activa por subcategoría (RN-25) y sin órdenes repetidos entre las activas.
CREATE UNIQUE INDEX ux_preguntas_activa_subcategoria ON preguntas_diagnostico (subcategoria_id) WHERE activa;
CREATE UNIQUE INDEX ux_preguntas_activa_orden ON preguntas_diagnostico (orden) WHERE activa;

CREATE TABLE opciones_diagnostico (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pregunta_id BIGINT       NOT NULL REFERENCES preguntas_diagnostico (id) ON DELETE CASCADE,
  orden       SMALLINT     NOT NULL,
  texto       VARCHAR(300) NOT NULL,
  puntuacion  NUMERIC(3,2) NOT NULL CHECK (puntuacion BETWEEN 0 AND 1),
  UNIQUE (pregunta_id, orden)
);

CREATE TABLE respuestas_diagnostico (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  examen_id       BIGINT      NOT NULL REFERENCES examenes_diagnostico (id) ON DELETE CASCADE,
  pregunta_id     BIGINT      NOT NULL REFERENCES preguntas_diagnostico (id),
  opcion_id       BIGINT      NOT NULL REFERENCES opciones_diagnostico (id),
  fecha_respuesta TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (examen_id, pregunta_id)
);

-- Versiones del modelo de regresión (RF-23, RNF-09).
CREATE TABLE modelos_regresion (
  id                      SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version                 VARCHAR(20)  NOT NULL UNIQUE,
  algoritmo               VARCHAR(60)  NOT NULL,
  registros_entrenamiento INTEGER      NOT NULL,
  mae                     NUMERIC(6,4) NOT NULL,
  rmse                    NUMERIC(6,4) NOT NULL,
  mae_baseline            NUMERIC(6,4) NOT NULL,
  rmse_baseline           NUMERIC(6,4) NOT NULL,
  artefacto               BYTEA        NOT NULL,
  activo                  BOOLEAN      NOT NULL DEFAULT false,
  entrenado_por           BIGINT       REFERENCES usuarios (id) ON DELETE SET NULL,
  fecha_entrenamiento     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Una sola versión activa.
CREATE UNIQUE INDEX ux_modelo_activo ON modelos_regresion ((activo)) WHERE activo;

-- Predicción más reciente por usuario y subcategoría (RN-06, RN-07).
CREATE TABLE predicciones_error (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id         BIGINT       NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  subcategoria_id    SMALLINT     NOT NULL REFERENCES subcategorias (id),
  puntaje_esperado   NUMERIC(4,3) NOT NULL CHECK (puntaje_esperado BETWEEN 0 AND 1),
  probabilidad_error NUMERIC(4,3) NOT NULL CHECK (probabilidad_error BETWEEN 0 AND 1),
  modelo_id          SMALLINT     REFERENCES modelos_regresion (id) ON DELETE SET NULL,   -- NULL = baseline
  fecha_calculo      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, subcategoria_id)
);

-- -----------------------------------------------------------------------------
-- Supabase expone `public` por su Data API. La app solo accede mediante la
-- API, así que se habilita RLS sin políticas: los roles anon/authenticated no
-- pueden leer ni escribir. La API se conecta con el rol propietario.
-- -----------------------------------------------------------------------------
ALTER TABLE usuarios                ENABLE ROW LEVEL SECURITY;
ALTER TABLE recuperaciones_password ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_ataque            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE niveles_dificultad      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rangos_vulnerabilidad   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escenarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE escenario_pasos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE senales_alerta          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opciones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE opcion_senal            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_evaluacion       ENABLE ROW LEVEL SECURITY;
ALTER TABLE intentos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_usuario      ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_usuario        ENABLE ROW LEVEL SECURITY;
ALTER TABLE examenes_diagnostico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas_diagnostico   ENABLE ROW LEVEL SECURITY;
ALTER TABLE opciones_diagnostico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_diagnostico  ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_regresion       ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones_error      ENABLE ROW LEVEL SECURITY;
