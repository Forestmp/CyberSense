# Genera las carpetas nativas (android/, web/) con `flutter create` y las ajusta
# para CyberSense. Se ejecuta una sola vez, después de instalar Flutter:
#   cd app
#   powershell -ExecutionPolicy Bypass -File scripts\preparar.ps1
# No toca lib/, pubspec.yaml ni assets/.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    throw 'No se encontró Flutter. Instálalo (https://docs.flutter.dev/get-started/install/windows) y vuelve a intentarlo.'
}

flutter create . --org com.cybersense --project-name cybersense --platforms android,web
if ($LASTEXITCODE -ne 0) { throw 'flutter create falló' }

# flutter create agrega un test de ejemplo que no aplica a esta app.
Remove-Item -Force -ErrorAction SilentlyContinue test\widget_test.dart

function Editar($ruta, [scriptblock]$cambio) {
    $texto = [IO.File]::ReadAllText($ruta)
    $nuevo = & $cambio $texto
    [IO.File]::WriteAllText($ruta, $nuevo, (New-Object Text.UTF8Encoding $false))
}

# 1. Manifiesto principal: permiso de Internet (las compilaciones release no lo incluyen) y nombre visible.
Editar 'android\app\src\main\AndroidManifest.xml' {
    param($t)
    if ($t -notmatch 'android.permission.INTERNET') {
        $t = $t -replace '(<manifest[^>]*>)', "`$1`n    <uses-permission android:name=`"android.permission.INTERNET`"/>"
    }
    $t -replace 'android:label="[^"]*"', 'android:label="CyberSense"'
}

# 2. Depuración: permite HTTP sin cifrar para la API local (http://10.0.2.2:8000). Release solo usa HTTPS.
Editar 'android\app\src\debug\AndroidManifest.xml' {
    param($t)
    if ($t -match 'usesCleartextTraffic') { return $t }
    $t -replace '</manifest>', "    <application android:usesCleartextTraffic=`"true`"/>`n</manifest>"
}

# 3. Android 7.0 (API 24) como versión mínima.
$gradle = if (Test-Path 'android\app\build.gradle.kts') { 'android\app\build.gradle.kts' } else { 'android\app\build.gradle' }
Editar $gradle {
    param($t)
    $t -replace 'minSdk\s*=\s*flutter\.minSdkVersion', 'minSdk = 24' -replace 'minSdkVersion\s+flutter\.minSdkVersion', 'minSdkVersion 24'
}

flutter pub get
Write-Host ''
Write-Host 'Listo. Prueba la app con:  flutter run' -ForegroundColor Green
