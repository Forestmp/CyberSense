# CyberSense · App móvil (Flutter)

Es la app de concientización ante ataques de ingeniería social. Está escrita en Flutter (Dart), apunta a Android 7.0 (API 24) o superior y también corre en navegador. Consume la API de [`../api`](../api).

## Primera vez

1. Instala Flutter siguiendo la [guía para Windows](https://docs.flutter.dev/get-started/install/windows). Incluye Android Studio o el SDK de Android.
2. Genera las carpetas nativas y ajústalas. Este paso deja Android 7.0 como mínimo, agrega el permiso de Internet y pone el nombre «CyberSense»:

   ```powershell
   cd app
   powershell -ExecutionPolicy Bypass -File scripts\preparar.ps1
   ```

## Ejecutar

```powershell
flutter run                                            # emulador Android → API en http://10.0.2.2:8000
flutter run -d chrome                                  # navegador → API en http://<host>:8000
flutter run --dart-define=API_URL=http://192.168.1.50:8000   # celular físico en la misma red
flutter test                                           # pruebas unitarias
```

## APK para producción

```powershell
flutter build apk --release --dart-define=API_URL=https://cybersense-aypo.onrender.com
```

El APK queda en `build/app/outputs/flutter-apk/app-release.apk`.

> **OneDrive:** si la compilación falla con errores de archivos bloqueados, pausa la sincronización de OneDrive mientras compilas o clona el proyecto fuera de la carpeta sincronizada.

## Estructura

| Ruta | Contenido |
|---|---|
| `lib/main.dart`, `lib/router.dart` | Arranque, rutas (go_router) y barra de pestañas |
| `lib/theme.dart` | Colores, tipografía (Inter), radios y sombras |
| `lib/api/client.dart` | Cliente HTTP y `ApiError` |
| `lib/state/auth.dart` | Sesión; el token se guarda en el almacenamiento seguro del sistema |
| `lib/util/` | Etiquetas, formatos de contenido simulado y validaciones |
| `lib/widgets/` | Componentes base y de dominio |
| `lib/screens/` | Pantallas: acceso, pestañas, simulación, resultado, retroalimentación, aprender y administración |
