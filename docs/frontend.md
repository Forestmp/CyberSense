# Frontend CyberSense

Aplicación Expo (SDK 57) con Expo Router. Funciona en Android, iOS y web desde el mismo código.

## Identidad visual

| Elemento | Valor |
|---|---|
| Logo | `mobile/assets/logo-cybersense.png` (completo) y `logo-escudo.png` (solo escudo). Se generan recortando el original, que está en `logo-cybersense-original.png`, sin cambiar su proporción. |
| Ícono de la app y favicon | `icon.png`, `android-icon-*.png`, `favicon.png` |
| Paleta | Ver [theme.js](../mobile/src/theme.js): azul marino `#0B1F4D`, azul `#2563EB`, azul brillante `#2F80FF`, azul claro `#EAF2FF` y cian `#22D3EE`. Para estados: verde `#16A34A`, ámbar `#F59E0B` y rojo `#DC2626`. |
| Tipografía | Inter (400, 500, 600, 700 y 800) mediante `@expo-google-fonts/inter` |
| Íconos | Ionicons (`@expo/vector-icons`) |

Los estados nunca se indican solo con color: siempre llevan ícono y texto, por ejemplo «✓ Baja» o «⚠ Alta».

## Estructura

```
src/
  app/
    bienvenida.js, login.js, registro.js        sin sesión
    (app)/(tabs)/                               navegación inferior
      index.js (Inicio), simulaciones.js, progreso.js, historial.js, perfil.js
    (app)/simulacion/[id].js                    introducción y decisiones paso a paso
    (app)/resultado/[id].js                     resultado del escenario
    (app)/retroalimentacion/[id].js             retroalimentación educativa (secciones plegables)
    (app)/aprender.js                           contenido educativo
    (app)/admin/escenarios/                     listado (tabla o tarjetas), vista y editor
    (app)/admin/usuarios/                       administración de usuarios
  components/
    ui.js           Logo, Marca, Screen, Header, SectionTitle, Card, Button, IconButton, Input,
                    Alert, Badge, ProgressBar, Segmented, Modal, Loading, EmptyState, ErrorState
    BottomNav.js, ScenarioCard.js, ResultCard.js, NivelBadge.js, EstadoBadge.js,
    Accordion.js, AuthLayout.js, ContenidoSimulado.js
  context/          AuthContext (sesión), FeedbackContext (avisos y confirmaciones)
  api/client.js     capa única de llamadas a la API
  hooks/            useIntento
  lib/              etiquetas, formatos de contenido, almacenamiento seguro
```

## Sesión

El token JWT se guarda en `expo-secure-store` en Android e iOS, y en `localStorage` en web. Nunca se guardan contraseñas. Si la API responde 401, la sesión se cierra automáticamente.

## Endpoints que faltan en el backend

| Necesidad | Endpoint sugerido | Situación actual |
|---|---|---|
| Recuperar contraseña | `POST /api/auth/forgot-password` y `POST /api/auth/reset-password`, con envío de correo | El enlace «¿Olvidaste tu contraseña?» abre un aviso para contactar al administrador, que puede restablecerla desde la administración de usuarios. |
| Contenido de «Aprender» | `GET /api/learning` (temas, señales, buenas prácticas) | El contenido está fijo en `app/(app)/aprender.js`. |

Todas las demás pantallas usan la API existente.

## Validación visual

Las pantallas se revisaron con capturas en Chrome sin interfaz: 412 × 915 (Android común) y 1280 × 800 (escritorio). En escritorio, la administración de escenarios cambia de tarjetas a tabla a partir de 768 px de ancho.
