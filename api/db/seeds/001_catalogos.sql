-- Catálogos base. Idempotente: se puede ejecutar varias veces.

INSERT INTO tipos_ataque (clave, nombre, prefijo_codigo, descripcion) VALUES
  ('phishing', 'Phishing', 'PH',
   'Engaño mediante correos electrónicos que buscan obtener información o provocar una acción.'),
  ('smishing', 'Smishing', 'SM',
   'Engaño mediante mensajes de texto (SMS) o aplicaciones de mensajería.')
ON CONFLICT (clave) DO NOTHING;

-- 15 subcategorías: 9 de smishing y 6 de phishing.
INSERT INTO subcategorias (tipo_ataque_id, clave, nombre, descripcion)
SELECT t.id, s.clave, s.nombre, s.descripcion
  FROM (VALUES
    ('smishing', 'suplantacion_empresa', 'Suplantación de empresa',
     'Mensaje que se hace pasar por un banco, una paquetería o un proveedor de servicios para que el usuario abra un enlace o entregue sus datos.'),
    ('smishing', 'suplantacion_persona_conocida', 'Suplantación de persona conocida',
     'Mensaje de alguien que dice ser un familiar, un amigo o un jefe con un número nuevo y pide dinero o un favor urgente.'),
    ('smishing', 'premio_falso', 'Premio falso',
     'Aviso de un premio, sorteo o regalo que exige pagar una cuota o entregar datos personales para recibirlo.'),
    ('smishing', 'multa_notificacion_gubernamental', 'Multa o notificación gubernamental',
     'Supuesto aviso de una dependencia de gobierno que pide pagar o consultar un adeudo en un enlace.'),
    ('smishing', 'numero_equivocado', 'Número equivocado',
     'Conversación que inicia como un error de destinatario y busca ganar confianza para después proponer una inversión o pedir dinero.'),
    ('smishing', 'oferta_trabajo', 'Oferta de trabajo',
     'Oferta de empleo con buen pago y poco esfuerzo que pide datos personales, un pago inicial o continuar en otra aplicación.'),
    ('smishing', 'cargo_tienda_erroneo', 'Cargo de tienda erróneo',
     'Aviso de una compra o un cargo no reconocido que invita a responder o a entrar a un enlace para cancelarlo.'),
    ('smishing', 'resultados_laboratorio_falsos', 'Resultados de laboratorio falsos',
     'Mensaje que indica que hay resultados médicos disponibles en un enlace o que pide confirmar datos para consultarlos.'),
    ('smishing', 'agotamiento_servicios', 'Agotamiento de servicios',
     'Aviso de que un servicio se suspenderá o se agotó si no se paga o renueva de inmediato.'),
    ('phishing', 'alertas_seguridad_ti', 'Alertas de seguridad de TI',
     'Correo que simula al área de sistemas o a un proveedor y pide verificar la cuenta.'),
    ('phishing', 'colaboracion_nube', 'Colaboración en la nube',
     'Notificación falsa de un documento compartido que lleva a una página de inicio de sesión fraudulenta.'),
    ('phishing', 'cobros_cancelacion', 'Cobros para cancelación',
     'Correo con una supuesta factura o renovación de suscripción que invita a cancelarla y pide datos de pago.'),
    ('phishing', 'citacion_judicial', 'Citación judicial, multa o derechos de autor',
     'Correo que amenaza con acciones legales, una multa o una denuncia para que el usuario abra un archivo o un enlace.'),
    ('phishing', 'formularios_rh_credenciales', 'Formularios de RH o encuestas con credenciales',
     'Correo que simula al área de recursos humanos y pide iniciar sesión con las credenciales de la organización.'),
    ('phishing', 'correo_corporativo_bec', 'Correo corporativo comprometido (BEC)',
     'Correo desde la cuenta real o imitada de un directivo o proveedor que pide transferencias o información confidencial.')
  ) AS s (tipo, clave, nombre, descripcion)
  JOIN tipos_ataque t ON t.clave = s.tipo
ON CONFLICT (clave) DO NOTHING;

INSERT INTO niveles_dificultad (clave, nombre, valor) VALUES
  ('basico', 'Básico', 1),
  ('intermedio', 'Intermedio', 2),
  ('avanzado', 'Avanzado', 3)
ON CONFLICT (clave) DO NOTHING;

-- Rangos de vulnerabilidad vigentes (RN-27).
INSERT INTO rangos_vulnerabilidad (version, nivel, nombre, puntaje_min, puntaje_max, descripcion, recomendacion, activo) VALUES
  ('v1', 'bajo', 'Bajo', 80, 100,
   'Tus decisiones fueron mayormente seguras.',
   'Sigue verificando remitentes y enlaces antes de actuar.', true),
  ('v1', 'medio', 'Medio', 60, 79.99,
   'Evitaste los riesgos más graves, pero hubo decisiones mejorables.',
   'Antes de actuar, revisa con calma el remitente, la dirección web y el tono del mensaje.', true),
  ('v1', 'alto', 'Alto', 40, 59.99,
   'Tomaste decisiones que podrían exponer tu información.',
   'No abras enlaces de mensajes inesperados; entra siempre por la app o el sitio oficial.', true),
  ('v1', 'critico', 'Crítico', 0, 39.99,
   'Tus decisiones habrían permitido el robo de información o dinero.',
   'Nunca ingreses datos sensibles desde un enlace recibido. Ante la duda, contacta a la institución por un canal oficial.', true)
ON CONFLICT (version, nivel) DO NOTHING;
