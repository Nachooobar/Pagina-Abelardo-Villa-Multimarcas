# Script para guardar el logo de Abelardo Villa Multimarcas
# Instrucciones:
# 1. Coloca la imagen del logo en la carpeta raíz del proyecto (mismo nivel que este script)
# 2. Asegúrate de que se llame "logo-abelardo.png" o "logo.png"
# 3. Ejecuta este script con PowerShell

Write-Host "=== Setup de Logo Abelardo Villa Multimarcas ===" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$imagesDir = Join-Path $projectRoot "public" "images"
$logoDestination = Join-Path $imagesDir "logo.png"

# Crear directorio si no existe
if (-not (Test-Path $imagesDir)) {
    New-Item -ItemType Directory -Path $imagesDir -Force | Out-Null
    Write-Host "✓ Carpeta public/images creada" -ForegroundColor Green
}

# Buscar archivo de logo en la raíz o en carpetas comunes
$logoSources = @(
    (Join-Path $projectRoot "logo.png"),
    (Join-Path $projectRoot "logo-abelardo.png"),
    (Join-Path $projectRoot "logo_abelardo_villa.png"),
    (Join-Path $projectRoot "abelardo-villa-logo.png")
)

$sourceFound = $null
foreach ($source in $logoSources) {
    if (Test-Path $source) {
        $sourceFound = $source
        break
    }
}

if ($sourceFound) {
    Copy-Item -Path $sourceFound -Destination $logoDestination -Force
    Write-Host "✓ Logo copiado a: public/images/logo.png" -ForegroundColor Green
    Write-Host "✓ Setup completado correctamente" -ForegroundColor Green
}
else {
    Write-Host "⚠ No se encontró el archivo de logo" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pasos para completar el setup:" -ForegroundColor Cyan
    Write-Host "1. Coloca tu archivo de logo (PNG) en la carpeta raíz del proyecto"
    Write-Host "2. Nómbralo como 'logo.png' o 'logo-abelardo.png'"
    Write-Host "3. Ejecuta este script nuevamente"
    Write-Host ""
    Write-Host "Alternativamente, copia manualmente el archivo a:" -ForegroundColor Yellow
    Write-Host "   $logoDestination"
    Write-Host ""
    Read-Host "Presiona Enter para salir"
}
