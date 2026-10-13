-- 003 · Vista de datos para el futuro modelo de clasificación binaria.
-- Una fila por intento finalizado. No se entrena ningún modelo en esta etapa;
-- la vista solo deja listo el conjunto de datos.
--
-- IMPORTANTE para el entrenamiento: las columnas "previo_*" y las del
-- escenario describen la situación ANTES del intento y pueden usarse como
-- variables de entrada. Las columnas de resultado (puntaje, errores,
-- aciertos, ...) pertenecen al propio intento: usarlas como entrada para
-- predecir `cometio_error` filtraría la respuesta (data leakage).

CREATE VIEW vw_dataset_intentos
WITH (security_invoker = true) AS
WITH base AS (
  SELECT i.id AS intento_id, i.usuario_id, i.escenario_id, e.tipo_ataque_id, t.clave AS tipo_ataque,
         d.valor AS dificultad, i.numero_intento, i.fecha_inicio, i.fecha_fin, i.duracion_ms,
         i.puntaje, i.nivel_vulnerabilidad, i.aciertos, i.errores, i.senales_detectadas, i.senales_totales
    FROM intentos i
    JOIN escenarios e ON e.id = i.escenario_id
    JOIN tipos_ataque t ON t.id = e.tipo_ataque_id
    JOIN niveles_dificultad d ON d.id = e.dificultad_id
   WHERE i.estado = 'finalizado'
),
decisiones AS (
  SELECT intento_id,
         count(*)                                         AS num_decisiones,
         count(*) FILTER (WHERE tipo_accion = 'riesgosa') AS acciones_riesgosas,
         count(*) FILTER (WHERE tipo_accion = 'critica')  AS acciones_criticas,
         round(avg(tiempo_respuesta_ms))::int             AS tiempo_respuesta_promedio_ms,
         max(tiempo_respuesta_ms)                         AS tiempo_respuesta_max_ms,
         string_agg(opcion_clave, '>' ORDER BY orden)     AS secuencia_decisiones
    FROM respuestas_usuario
   GROUP BY intento_id
)
SELECT b.intento_id, b.usuario_id, b.escenario_id, b.tipo_ataque, b.dificultad, b.numero_intento, b.fecha_fin,
       -- Historial previo (variables de entrada)
       count(*) OVER w_usuario - 1                                         AS previo_intentos_total,
       count(*) OVER w_tipo - 1                                            AS previo_intentos_mismo_tipo,
       round(avg(b.puntaje) OVER w_tipo_previo, 2)                         AS previo_puntaje_promedio_mismo_tipo,
       COALESCE(sum(b.errores) OVER w_tipo_previo, 0)                      AS previo_errores_mismo_tipo,
       COALESCE(sum(b.aciertos) OVER w_tipo_previo, 0)                     AS previo_aciertos_mismo_tipo,
       lag(b.puntaje) OVER w_tipo                                          AS previo_ultimo_puntaje_mismo_tipo,
       -- Resultado del intento (no usar como entrada para predecir la etiqueta)
       dc.num_decisiones, dc.acciones_riesgosas, dc.acciones_criticas, dc.secuencia_decisiones,
       dc.tiempo_respuesta_promedio_ms, dc.tiempo_respuesta_max_ms, b.duracion_ms,
       b.aciertos, b.errores, b.senales_detectadas, b.senales_totales, b.puntaje, b.nivel_vulnerabilidad,
       -- Etiqueta binaria
       (b.errores > 0)                                                     AS cometio_error
  FROM base b
  JOIN decisiones dc ON dc.intento_id = b.intento_id
WINDOW w_usuario     AS (PARTITION BY b.usuario_id ORDER BY b.fecha_fin, b.intento_id),
       w_tipo        AS (PARTITION BY b.usuario_id, b.tipo_ataque_id ORDER BY b.fecha_fin, b.intento_id),
       w_tipo_previo AS (PARTITION BY b.usuario_id, b.tipo_ataque_id ORDER BY b.fecha_fin, b.intento_id
                         ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING);

COMMENT ON VIEW vw_dataset_intentos IS
  'Conjunto de datos por intento finalizado para el modelo de clasificación binaria (etiqueta: cometio_error). Columnas previo_* = variables de entrada; columnas de resultado = solo análisis.';
