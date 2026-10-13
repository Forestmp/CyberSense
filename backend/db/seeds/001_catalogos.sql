-- Catálogos base. Idempotente: se puede ejecutar varias veces.

INSERT INTO tipos_ataque (clave, nombre, prefijo_codigo, descripcion) VALUES
  ('phishing', 'Phishing', 'PH',
   'Engaño mediante correos electrónicos o sitios web falsos para obtener información o provocar una acción.'),
  ('smishing', 'Smishing', 'SM',
   'Engaño mediante mensajes de texto (SMS) o mensajería instantánea.'),
  ('suplantacion_identidad', 'Suplantación de identidad', 'SI',
   'El atacante se hace pasar por una persona u organización de confianza (llamadas, perfiles falsos, etc.).')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO niveles_dificultad (clave, nombre, valor) VALUES
  ('basico', 'Básico', 1),
  ('intermedio', 'Intermedio', 2),
  ('avanzado', 'Avanzado', 3)
ON CONFLICT (clave) DO NOTHING;

-- Rangos PROVISIONALES (versión 'v0-provisional'). No están validados
-- empíricamente; se sustituirán por los que se definan en el análisis.
INSERT INTO rangos_vulnerabilidad (version, nivel, nombre, puntaje_min, puntaje_max, descripcion, recomendacion, activo) VALUES
  ('v0-provisional', 'bajo', 'Bajo', 80, 100,
   'Tus decisiones fueron mayormente seguras.',
   'Sigue verificando remitentes y enlaces antes de actuar.', true),
  ('v0-provisional', 'medio', 'Medio', 60, 79.99,
   'Evitaste los riesgos más graves, pero hubo decisiones mejorables.',
   'Antes de actuar, revisa con calma el remitente, la dirección web y el tono del mensaje.', true),
  ('v0-provisional', 'alto', 'Alto', 40, 59.99,
   'Tomaste decisiones que podrían exponer tu información.',
   'No abras enlaces de mensajes inesperados; entra siempre por la app o el sitio oficial.', true),
  ('v0-provisional', 'critico', 'Crítico', 0, 39.99,
   'Tus decisiones habrían permitido el robo de información o dinero.',
   'Nunca ingreses datos sensibles desde un enlace recibido. Ante la duda, contacta a la institución por un canal oficial.', true)
ON CONFLICT (version, nivel) DO NOTHING;
