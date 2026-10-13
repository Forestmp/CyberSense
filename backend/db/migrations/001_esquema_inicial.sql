-- =============================================================================
-- 001 · Esquema inicial
-- Sistema móvil para la concientización y evaluación educativa ante ataques de
-- ingeniería social mediante simulaciones interactivas (TT ESCOM-IPN).
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
-- Catálogos
-- -----------------------------------------------------------------------------
CREATE TABLE tipos_ataque (
  id             SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave          VARCHAR(40)  NOT NULL UNIQUE,      -- phishing, smishing, ...
  nombre         VARCHAR(80)  NOT NULL,
  prefijo_codigo VARCHAR(4)   NOT NULL UNIQUE,      -- PH, SM, SI → códigos PH-001
  descripcion    TEXT
);

CREATE TABLE niveles_dificultad (
  id     SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave  VARCHAR(20) NOT NULL UNIQUE,               -- basico, intermedio, avanzado
  nombre VARCHAR(40) NOT NULL,
  valor  SMALLINT    NOT NULL UNIQUE                -- ordinal (útil como variable para ML)
);

-- Rangos para clasificar el puntaje (0–100, mayor = comportamiento más seguro)
-- en un nivel de vulnerabilidad. Los valores iniciales son PROVISIONALES: se
-- definirán formalmente durante el análisis del proyecto. Para cambiarlos se
-- crea una nueva `version` y se marca como activa.
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
-- Usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              VARCHAR(100) NOT NULL,
  correo              VARCHAR(254) NOT NULL,
  password_hash       TEXT         NOT NULL,
  rol                 VARCHAR(20)  NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin')),
  estado              VARCHAR(20)  NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'bloqueado')),
  fecha_registro      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_usuarios_correo ON usuarios (lower(correo));
CREATE TRIGGER trg_usuarios_actualizacion BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_fecha_actualizacion();

-- -----------------------------------------------------------------------------
-- Escenarios
-- Un escenario se compone de pasos; cada paso muestra contenido simulado
-- (correo, SMS, sitio web, llamada…) y ofrece opciones. Cada opción puede
-- llevar a otro paso (ramificación) o terminar el escenario.
-- -----------------------------------------------------------------------------
CREATE TABLE escenarios (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                    VARCHAR(12)  NOT NULL UNIQUE,   -- PH-001
  titulo                    VARCHAR(150) NOT NULL,
  tipo_ataque_id            SMALLINT     NOT NULL REFERENCES tipos_ataque (id),
  dificultad_id             SMALLINT     NOT NULL REFERENCES niveles_dificultad (id),
  descripcion               TEXT         NOT NULL,
  contenido                 JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- contexto general
  retroalimentacion_general TEXT,
  estado                    VARCHAR(20)  NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador', 'activo', 'inactivo', 'eliminado')),
  creado_por                BIGINT       REFERENCES usuarios (id) ON DELETE SET NULL,
  fecha_creacion            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_actualizacion       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_escenarios_tipo_estado ON escenarios (tipo_ataque_id, estado);
CREATE TRIGGER trg_escenarios_actualizacion BEFORE UPDATE ON escenarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_fecha_actualizacion();

CREATE TABLE escenario_pasos (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escenario_id BIGINT      NOT NULL REFERENCES escenarios (id) ON DELETE CASCADE,
  clave       VARCHAR(40)  NOT NULL,          -- identificador estable dentro del escenario
  orden       SMALLINT     NOT NULL,
  titulo      VARCHAR(150) NOT NULL,
  pregunta    TEXT         NOT NULL,          -- p. ej. "¿Qué haces?"
  contenido   JSONB        NOT NULL,          -- {formato: 'correo'|'sms'|'sitio_web'|..., ...}
  es_inicial  BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE (escenario_id, clave),
  UNIQUE (escenario_id, orden)
);
-- Un único paso inicial por escenario.
CREATE UNIQUE INDEX ux_pasos_inicial ON escenario_pasos (escenario_id) WHERE es_inicial;

-- Señales de alerta presentes en el escenario (dominio sospechoso, urgencia…).
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
  clave             VARCHAR(40)  NOT NULL,    -- única dentro del escenario (validado en la API)
  orden             SMALLINT     NOT NULL,
  texto             VARCHAR(300) NOT NULL,
  tipo_accion       VARCHAR(20)  NOT NULL CHECK (tipo_accion IN ('segura', 'neutral', 'riesgosa', 'critica')),
  puntuacion        INTEGER      NOT NULL,    -- positivo = seguro, negativo = riesgoso
  retroalimentacion TEXT         NOT NULL,    -- se muestra solo al terminar el escenario
  siguiente_paso_id BIGINT       REFERENCES escenario_pasos (id) ON DELETE SET NULL,  -- NULL = fin
  UNIQUE (paso_id, clave),
  UNIQUE (paso_id, orden)
);
CREATE INDEX ix_opciones_siguiente_paso ON opciones (siguiente_paso_id);

-- Qué señales de alerta demuestra haber identificado el usuario al elegir la opción.
CREATE TABLE opcion_senal (
  opcion_id BIGINT NOT NULL REFERENCES opciones (id) ON DELETE CASCADE,
  senal_id  BIGINT NOT NULL REFERENCES senales_alerta (id) ON DELETE CASCADE,
  PRIMARY KEY (opcion_id, senal_id)
);
CREATE INDEX ix_opcion_senal_senal ON opcion_senal (senal_id);

-- Reglas deterministas del motor de evaluación. `escenario_id` NULL = regla global.
--   OPCION_SELECCIONADA   {"opcion": "<clave>"}
--   TIPO_ACCION_PRESENTE  {"tipo_accion": "critica"}
--   CONTEO_TIPO_ACCION    {"tipo_accion": "riesgosa", "minimo": 2}
--   SECUENCIA             {"opciones": ["<clave1>", "<clave2>"]}  (en ese orden)
CREATE TABLE reglas_evaluacion (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escenario_id      BIGINT       REFERENCES escenarios (id) ON DELETE CASCADE,
  tipo_regla        VARCHAR(30)  NOT NULL
                    CHECK (tipo_regla IN ('OPCION_SELECCIONADA', 'TIPO_ACCION_PRESENTE', 'CONTEO_TIPO_ACCION', 'SECUENCIA')),
  parametros        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ajuste_puntuacion INTEGER      NOT NULL DEFAULT 0,
  descripcion       VARCHAR(200) NOT NULL,
  retroalimentacion TEXT,
  activa            BOOLEAN      NOT NULL DEFAULT true,
  prioridad         SMALLINT     NOT NULL DEFAULT 0
);
CREATE INDEX ix_reglas_escenario ON reglas_evaluacion (escenario_id) WHERE activa;

-- -----------------------------------------------------------------------------
-- Ejecución de simulaciones
-- -----------------------------------------------------------------------------
CREATE TABLE intentos (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id           BIGINT       NOT NULL REFERENCES usuarios (id),
  escenario_id         BIGINT       NOT NULL REFERENCES escenarios (id),
  numero_intento       INTEGER      NOT NULL,      -- n-ésima vez que el usuario realiza el escenario
  estado               VARCHAR(20)  NOT NULL DEFAULT 'en_curso'
                       CHECK (estado IN ('en_curso', 'finalizado', 'abandonado')),
  paso_actual_id       BIGINT       REFERENCES escenario_pasos (id) ON DELETE SET NULL,
  fecha_inicio         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_fin            TIMESTAMPTZ,
  duracion_ms          INTEGER,
  -- Resultados (se llenan al finalizar)
  puntaje_bruto        INTEGER,
  puntaje              NUMERIC(5,2) CHECK (puntaje BETWEEN 0 AND 100),
  nivel_vulnerabilidad VARCHAR(20)  CHECK (nivel_vulnerabilidad IN ('bajo', 'medio', 'alto', 'critico')),
  errores              SMALLINT,
  aciertos             SMALLINT,
  senales_detectadas   SMALLINT,
  senales_totales      SMALLINT,
  resultado            JSONB,                      -- detalle de la retroalimentación calculada
  version_rangos       VARCHAR(20),
  UNIQUE (usuario_id, escenario_id, numero_intento)
);
CREATE INDEX ix_intentos_usuario_fecha ON intentos (usuario_id, fecha_inicio DESC);
CREATE INDEX ix_intentos_escenario ON intentos (escenario_id);

-- Cada decisión tomada. Se copian texto, tipo de acción y puntuación de la
-- opción al momento de responder para que editar un escenario no altere el
-- historial.
CREATE TABLE respuestas_usuario (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intento_id          BIGINT       NOT NULL REFERENCES intentos (id) ON DELETE CASCADE,
  paso_id             BIGINT       REFERENCES escenario_pasos (id) ON DELETE SET NULL,
  opcion_id           BIGINT       REFERENCES opciones (id) ON DELETE SET NULL,
  orden               SMALLINT     NOT NULL,
  opcion_clave        VARCHAR(40)  NOT NULL,
  texto_opcion        VARCHAR(300) NOT NULL,
  tipo_accion         VARCHAR(20)  NOT NULL,
  puntuacion          INTEGER      NOT NULL,
  fecha_respuesta     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  tiempo_respuesta_ms INTEGER      CHECK (tiempo_respuesta_ms >= 0),
  UNIQUE (intento_id, orden),
  UNIQUE (intento_id, paso_id)
);

-- Resumen por usuario y tipo de ataque. Se actualiza en la misma transacción
-- que finaliza un intento.
CREATE TABLE metricas_usuario (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id           BIGINT       NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  tipo_ataque_id       SMALLINT     NOT NULL REFERENCES tipos_ataque (id),
  total_intentos       INTEGER      NOT NULL DEFAULT 0,
  aciertos             INTEGER      NOT NULL DEFAULT 0,   -- decisiones seguras acumuladas
  errores              INTEGER      NOT NULL DEFAULT 0,   -- decisiones riesgosas/críticas acumuladas
  puntaje_promedio     NUMERIC(5,2),
  ultimo_puntaje       NUMERIC(5,2),
  nivel_vulnerabilidad VARCHAR(20)  CHECK (nivel_vulnerabilidad IN ('bajo', 'medio', 'alto', 'critico')),
  ultima_actualizacion TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tipo_ataque_id)
);

-- -----------------------------------------------------------------------------
-- Supabase expone el esquema `public` por su Data API (PostgREST). La app
-- accede solo mediante nuestra API, así que se habilita RLS sin políticas:
-- los roles anon/authenticated de Supabase no pueden leer ni escribir.
-- El backend se conecta con el rol propietario, que no está sujeto a RLS.
-- -----------------------------------------------------------------------------
ALTER TABLE tipos_ataque          ENABLE ROW LEVEL SECURITY;
ALTER TABLE niveles_dificultad    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rangos_vulnerabilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE escenarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE escenario_pasos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE senales_alerta        ENABLE ROW LEVEL SECURITY;
ALTER TABLE opciones              ENABLE ROW LEVEL SECURITY;
ALTER TABLE opcion_senal          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_evaluacion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE intentos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas_usuario    ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_usuario      ENABLE ROW LEVEL SECURITY;
