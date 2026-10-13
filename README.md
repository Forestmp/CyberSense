# Sistema móvil para la concientización y evaluación educativa ante ataques de ingeniería social

Trabajo Terminal · ESCOM-IPN

Aplicación móvil que enseña a reconocer ataques de ingeniería social (phishing, smishing y suplantación de identidad) mediante **simulaciones educativas controladas**. Ningún escenario se conecta con bancos, correos ni servicios reales; las instituciones mencionadas son ficticias.

```
App móvil (Expo)  →  API REST (Node.js + Express)  →  PostgreSQL (Supabase)
                          │
                          ├─ Motor de evaluación basado en reglas (reglas-v1)
                          └─ Selector del siguiente escenario (punto de extensión para el motor adaptativo)
```

La app nunca se conecta directamente a la base de datos.

> **Estado:** MVP funcional. Incluye registro e inicio de sesión, simulaciones con varias decisiones, evaluación por reglas, resultados, historial, métricas y la administración de escenarios y usuarios. El modelo de Machine Learning y el motor adaptativo definitivo quedan para etapas posteriores; los datos ya se preparan para ellos.

## Estructura

```
backend/
  src/modules/
    auth/         registro, login, JWT
    users/        perfil y CRUD de usuarios (admin), historial y métricas
    scenarios/    CRUD de escenarios, catálogos, validación del grafo
    attempts/     ejecución de simulaciones paso a paso
    evaluation/   motor de reglas (función pura)
    metrics/      historial y métricas
    adaptive/     selector del siguiente escenario (estrategias intercambiables)
  db/migrations/  esquema SQL, aplicado en orden
  db/seeds/       catálogos, rangos provisionales y escenarios (PH-001.json)
  tests/          pruebas sobre un PostgreSQL embebido y desechable
mobile/
  src/app/        pantallas (Expo Router)
  src/components/ componentes de interfaz y contenido simulado
docs/             modelo de datos y decisiones de diseño
```

## Requisitos

- Node.js 20 o superior
- Un proyecto en [Supabase](https://supabase.com); el plan gratuito es suficiente
- En el celular: la app **Expo Go**

## 1. Base de datos (Supabase)

1. Crea un proyecto en Supabase.
2. Ve a **Connect → Direct → Session pooler** y copia la cadena de conexión.
3. No es necesario crear tablas a mano: lo hacen las migraciones. Todas las tablas quedan con **RLS habilitado y sin políticas**, así que la Data API pública de Supabase no puede leerlas; solo la API del proyecto accede a ellas.

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env          # completa DATABASE_URL, JWT_SECRET y ADMIN_*
npm run db:migrate            # crea el esquema desde cero
npm run db:seed               # catálogos, rangos, PH-001 y administrador
npm run dev                   # http://localhost:3000/api/health
```

| Script | Descripción |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Carga los datos iniciales (idempotente) |
| `node scripts/seed.js --actualizar-escenarios` | Sobrescribe los escenarios existentes con su JSON (solo en desarrollo) |
| `npm run db:reset` | **Borra** las tablas del esquema `public` y las recrea (bloqueado en producción) |
| `npm test` | Pruebas automatizadas sobre PostgreSQL 17 embebido; no tocan Supabase |

## 3. App móvil

```bash
cd mobile
npm install
npx expo start                # escanea el QR con Expo Go, o pulsa "w" para abrirla en el navegador
```

- El celular debe estar en la misma red WiFi que la computadora. La app detecta sola la IP de la computadora y usa el puerto 3000 de la API.
- Para apuntar a otra API, crea `mobile/.env` con `EXPO_PUBLIC_API_URL=http://<ip>:3000`.
- Si no conecta, permite Node.js en el Firewall de Windows.

## API

Todas las rutas, excepto registro, login y health, requieren `Authorization: Bearer <token>`. Los errores tienen la forma `{ error: { code, message, details } }`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | público | Registro (nombre, correo, contraseña, confirmación) |
| POST | `/api/auth/login` | público | Inicio de sesión |
| GET | `/api/auth/me` | usuario | Usuario autenticado |
| GET | `/api/users` | admin | Listado paginado, con búsqueda y filtros |
| POST | `/api/users` | admin | Crear usuario con rol |
| GET / PUT | `/api/users/:id` | propio / admin | Consultar o editar perfil |
| DELETE | `/api/users/:id` | admin | Eliminación lógica |
| GET | `/api/users/:id/history` | propio / admin | Simulaciones finalizadas |
| GET | `/api/users/:id/metrics` | propio / admin | Resumen, métricas por tipo de ataque y evolución |
| GET | `/api/catalogos` | usuario | Tipos de ataque, dificultades y enumeraciones |
| GET | `/api/scenarios` | usuario | Usuarios: escenarios activos con su desempeño. Admin: todos |
| GET | `/api/scenarios/recommended` | usuario | Siguiente escenario sugerido |
| GET | `/api/scenarios/:id` | usuario | Usuario: resumen. Admin: documento completo |
| POST / PUT | `/api/scenarios[/:id]` | admin | Crear o reemplazar un escenario (pasos, opciones, señales, reglas) |
| PATCH | `/api/scenarios/:id` | admin | Cambiar estado (activo, inactivo, borrador) |
| DELETE | `/api/scenarios/:id` | admin | Eliminación lógica |
| POST | `/api/attempts` | usuario | Iniciar intento; devuelve el primer paso |
| GET | `/api/attempts/:id` | dueño / admin | Paso actual o resultado |
| POST | `/api/attempts/:id/responses` | dueño | Registrar una decisión; devuelve el siguiente paso **sin revelar si fue correcta** |
| POST | `/api/attempts/:id/finish` | dueño | Evaluar y guardar el resultado |
| POST | `/api/attempts/:id/abandon` | dueño | Abandonar el intento |

## Motor de evaluación (reglas-v1)

Ver [engine.js](backend/src/modules/evaluation/engine.js).

1. Se suman las puntuaciones de las opciones elegidas: positivas para decisiones seguras, negativas para riesgosas.
2. Se aplican las reglas del escenario y las reglas globales: `OPCION_SELECCIONADA`, `TIPO_ACCION_PRESENTE`, `CONTEO_TIPO_ACCION` y `SECUENCIA`.
3. El puntaje bruto se normaliza a 0–100 con la mejor y la peor ruta posibles del escenario.
4. El nivel de vulnerabilidad sale de la tabla `rangos_vulnerabilidad`.
5. Se calculan las decisiones con su valoración, los errores, las señales detectadas y las no detectadas, la ruta recomendada y las recomendaciones.

### Valores provisionales

Los rangos de vulnerabilidad (versión `v0-provisional`: crítico < 40 ≤ alto < 60 ≤ medio < 80 ≤ bajo) y las puntuaciones de PH-001 son **valores iniciales de trabajo, no criterios validados**. Se pueden modificar en la base de datos o desde el editor de escenarios sin tocar código, y se definirán formalmente durante el análisis del proyecto.

## Preparación para Machine Learning

- **Vista `vw_dataset_intentos`:** una fila por intento finalizado. Las columnas `previo_*` describen el historial del usuario antes del intento y sirven como variables de entrada. La etiqueta binaria es `cometio_error`. Las columnas de resultado del propio intento no deben usarse como entrada, porque filtrarían la respuesta.
- **Datos registrados:** cada respuesta guarda el tiempo de respuesta medido en el servidor y una copia de la opción elegida.
- **Selector de escenario:** [selector.js](backend/src/modules/adaptive/selector.js) acepta estrategias intercambiables. Hoy usa `reglas-provisional`; el modelo se integrará como una estrategia nueva, sin cambiar la API.

## Documentación

- [docs/modelo-de-datos.md](docs/modelo-de-datos.md): tablas, relaciones y justificación de los cambios respecto a la propuesta inicial.
