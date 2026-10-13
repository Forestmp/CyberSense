# Sistema móvil para la concientización y evaluación educativa ante ataques de ingeniería social

Trabajo Terminal · ESCOM-IPN

Aplicación móvil que enseña a reconocer ataques de ingeniería social (phishing, smishing y suplantación de identidad) mediante **simulaciones educativas controladas**. Ningún escenario se conecta con bancos, correos ni servicios reales.

```
App móvil (Expo)  →  API REST (Node.js + Express)  →  PostgreSQL (Supabase)
```

La app nunca se conecta directamente a la base de datos.

> **Estado:** MVP en construcción. Etapa 1 completa (estructura y base de datos). El modelo de Machine Learning y el motor adaptativo están fuera del alcance de esta etapa.

## Estructura

```
backend/
  src/            API (config, db, middlewares, modules, utils)
  db/migrations/  Esquema en SQL, aplicado en orden
  db/seeds/       Catálogos, rangos provisionales y escenarios de ejemplo (PH-001)
  scripts/        migrate.js, seed.js
  tests/          Pruebas (usan un PostgreSQL embebido y desechable)
mobile/           App Expo (etapa 8)
docs/             Modelo de datos y decisiones de diseño
```

## Requisitos

- Node.js 20 o superior
- Un proyecto en [Supabase](https://supabase.com) (plan gratuito suficiente)

## Configuración de Supabase

1. Crea un proyecto en Supabase y guarda la contraseña de la base de datos.
2. En el proyecto: **Connect** (o *Project Settings → Database*) → **Connection string** → **Session pooler**. Esta conexión funciona en redes IPv4; la conexión *Direct* requiere IPv6.
3. Copia la cadena de conexión; la usarás como `DATABASE_URL`.

No es necesario crear tablas a mano: el script de migraciones lo hace. Las tablas quedan con **RLS habilitado y sin políticas**, de modo que la Data API pública de Supabase no puede leerlas; solo la API del proyecto accede a ellas.

## Ejecución local

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
| `npm start` | API en modo normal |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga datos iniciales (idempotente) |
| `npm run db:reset` | **Borra** las tablas del esquema `public` y las recrea (no permitido con `NODE_ENV=production`) |
| `npm test` | Pruebas automatizadas sobre un PostgreSQL 17 embebido (no toca Supabase) |

## Valores provisionales

Los rangos de vulnerabilidad (`rangos_vulnerabilidad`, versión `v0-provisional`) y las puntuaciones de las opciones de PH-001 son **valores iniciales de trabajo**, no criterios validados. Se pueden modificar en la base de datos sin cambiar el código y se definirán formalmente durante el análisis del proyecto.

## Documentación

- [docs/modelo-de-datos.md](docs/modelo-de-datos.md): tablas, relaciones y justificación de los cambios respecto a la propuesta inicial.
