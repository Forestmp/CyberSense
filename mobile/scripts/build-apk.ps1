<#
  Compila el APK de CyberSense desde una ruta corta (C:\cs) para evitar el
  límite de 260 caracteres de Windows.

  Uso (PowerShell, desde la carpeta mobile):
    .\scripts\build-apk.ps1
  Resultado: ..\dist\CyberSense-v<versión>.apk

  IMPORTANTE: nunca compilar dentro de OneDrive. El NDK crea enlaces duros de
  libc++_shared.so; si alguno queda en una carpeta sincronizada, OneDrive marca
  el archivo (reparse point 0x9000601a) y Gradle falla con "Cannot snapshot ...
  not a regular file". Si vuelve a ocurrir: borrar las carpetas android/build y
  .cxx dentro de OneDrive y reemplazar el libc++_shared.so marcado del NDK por
  una copia normal.
#>
# Continue: en PowerShell 5.1 las advertencias de npm/gradle en stderr no deben
# detener el script; se revisa el código de salida de cada comando.
$ErrorActionPreference = 'Continue'
function Revisar($paso) { if ($LASTEXITCODE -ne 0) { Pop-Location -ErrorAction SilentlyContinue; Pop-Location -ErrorAction SilentlyContinue; throw "Falló: $paso (código $LASTEXITCODE)" } }
$origen = Split-Path -Parent $PSScriptRoot      # ...\TT-1\mobile
$copia = 'C:\cs'
$dist = Join-Path (Split-Path -Parent $origen) 'dist'

Write-Host '1/5 Sincronizando código en' $copia
robocopy $origen $copia /MIR /MT:16 /NFL /NDL /NJH /NJS /NP /XD "$origen\node_modules" "$origen\android" "$origen\.expo" "$copia\node_modules" "$copia\android" | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falló ($LASTEXITCODE)" }

Write-Host '2/5 Instalando dependencias'
Push-Location $copia
# cmd /c no hereda la carpeta de Push-Location: se indica con cd /d.
cmd /c "cd /d $copia && npm install --no-audit --no-fund --loglevel=error 2>&1" | Out-Null
Revisar 'npm install'

Write-Host '3/5 Limpiando compilaciones nativas anteriores'
Get-ChildItem "$copia\node_modules" -Recurse -Directory -ErrorAction SilentlyContinue |
  Where-Object { ($_.Name -eq 'build' -and ((Test-Path "$($_.Parent.FullName)\build.gradle") -or (Test-Path "$($_.Parent.FullName)\build.gradle.kts"))) -or $_.Name -eq '.cxx' } |
  ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host '4/5 Generando proyecto Android (expo prebuild)'
$env:CI = '1'
cmd /c "cd /d $copia && npx expo prebuild -p android --clean 2>&1" | Out-Null
Revisar 'expo prebuild'

Write-Host '5/5 Compilando APK (puede tardar 20-30 minutos)'
$env:NODE_ENV = 'production'   # usa mobile/.env.production (URL de la API en Render)
Push-Location "$copia\android"
cmd /c "cd /d $copia\android && gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain 2>&1"
Revisar 'gradle assembleRelease'
Pop-Location; Pop-Location

$version = (Get-Content "$origen\app.json" -Raw | ConvertFrom-Json).expo.version
New-Item -ItemType Directory -Force $dist | Out-Null
$destino = Join-Path $dist "CyberSense-v$version.apk"
Copy-Item "$copia\android\app\build\outputs\apk\release\app-release.apk" $destino -Force
Write-Host "Listo: $destino"
