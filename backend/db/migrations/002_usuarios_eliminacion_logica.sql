-- 002 · Eliminación lógica de usuarios.
-- Un usuario con intentos no puede borrarse físicamente sin perder historial
-- (y datos para ML); se marca como 'eliminado' y deja de poder iniciar sesión.

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_estado_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_estado_check
  CHECK (estado IN ('activo', 'inactivo', 'bloqueado', 'eliminado'));

ALTER TABLE usuarios ADD COLUMN fecha_eliminacion TIMESTAMPTZ;

CREATE INDEX ix_usuarios_estado_rol ON usuarios (estado, rol);
