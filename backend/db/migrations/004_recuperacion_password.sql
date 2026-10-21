-- 004 · Recuperación de contraseña por código enviado al correo.

-- Códigos de un solo uso. Solo se guarda un HMAC del código, nunca el código.
CREATE TABLE recuperaciones_password (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  codigo_hash TEXT        NOT NULL,
  intentos    SMALLINT    NOT NULL DEFAULT 0,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ
);
CREATE INDEX ix_recuperaciones_usuario ON recuperaciones_password (usuario_id, creado_en DESC);
ALTER TABLE recuperaciones_password ENABLE ROW LEVEL SECURITY;

-- Versión de sesión: al cambiar la contraseña se incrementa y los tokens
-- emitidos antes dejan de ser válidos (cierra sesiones en otros dispositivos).
ALTER TABLE usuarios ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
