<#
.SYNOPSIS
  Ejecuta los jobs de ingesta/mantenimiento en secuencia desde una maquina
  propia (hoy: el VPS), en reemplazo de los Vercel Cron de vercel.json.

.DESCRIPTION
  IMPORTANTE: este archivo se mantiene en ASCII puro (sin acentos, sin guiones
  largos). Windows PowerShell 5.1 lee los .ps1 sin BOM como ANSI, no UTF-8, y
  cualquier caracter multi-byte dentro de una cadena rompe el parseo del script
  entero. Si agregas texto, escribilo sin tildes.

  Por que existe: los Vercel Cron corren con maxDuration=60 en el plan Hobby.
  Varios jobs no entran en ese presupuesto. sync-listado tarda ~30 min por
  pasada completa, y sync-sea-pertinencia consulta el detalle de cada
  pertinencia una por una: murio por timeout todos los dias entre el 2026-08-06
  y el 2026-08-11 sin que nadie lo notara. Aca no hay limite de tiempo.

  Cada job registra su propia corrida en cron_run_log, el mismo mecanismo que
  usan las rutas de cron, asi que /admin/operacion sigue siendo la fuente de
  verdad sobre que corrio y como termino, sin importar quien lo disparo.

  Un job que falla NO detiene a los siguientes: se anota y se sigue. La idea es
  que un problema en una fuente no deje sin actualizar a todas las demas.

.PARAMETER Set
  daily   - los que corrian a diario en Vercel, en el mismo orden.
  weekly  - los semanales, mas los tres SIPUB que nunca tuvieron cron.
  monthly - PELP. Se publica por version de informe, no cambia a diario.
  all     - los tres.

.PARAMETER NodeDir
  Carpeta que contiene node.exe, por si el PATH de la tarea programada no lo
  trae. En el VPS: C:\Users\Admin\tools\nodejs

.NOTES
  Fuera de este runner a proposito:
  - sync-cne-construccion : depende de un .xlsx que hay que bajar a mano de la
    CNE a dataset/. No se puede automatizar sin agregarle un paso de descarga.
  - sync-formulario-bulk  : consume IA por lote; se corre a demanda para no
    generar costo en cada pasada.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\run-syncs.ps1 -Set daily
#>
[CmdletBinding()]
param(
  [ValidateSet('daily', 'weekly', 'monthly', 'all')]
  [string]$Set = 'daily',

  [string]$NodeDir = ''
)

$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if ($NodeDir -and (Test-Path (Join-Path $NodeDir 'node.exe'))) {
  $env:PATH = "$NodeDir;$env:PATH"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "node no esta en el PATH. Pasa -NodeDir con la carpeta que contiene node.exe."
  exit 1
}

$tsx = Join-Path $repoRoot 'node_modules\.bin\tsx.cmd'
if (-not (Test-Path $tsx)) {
  Write-Error "Falta $tsx. Corre 'npm ci' en $repoRoot primero."
  exit 1
}

# Orden espejo del que tenian los Vercel Cron. send-daily-project-report va
# ultimo a proposito: reporta sobre lo que los jobs anteriores acaban de cargar.
#
# Cada entrada lleva sus argumentos porque varios scripts NO tienen los mismos
# valores por defecto que usaba su ruta de cron. El caso grave fue
# preverify-projects: sin --apply corre en modo simulacion, gasta ~10 min de
# IA y no escribe un solo campo. Verificado contra
# app/api/cron/preverify-editorial/route.ts.
$daily = @(
  @{ name = 'sync-listado';              args = @() },
  @{ name = 'sync-pgp-progress';         args = @() },
  @{ name = 'screen-verification-queue'; args = @() },
  @{ name = 'preverify-projects';        args = @(
      '--provider', 'nemotron',   # el cron fija PREVERIFICATION_REVIEW_PROVIDER=nemotron; el script por defecto usa glm
      '--limit', '10',
      '--concurrency', '2',
      '--apply',                  # sin esto no aplica NADA
      '--persist',
      '--editorial-only',
      # Por defecto escribe un .md con fecha dentro de docs/, ensuciando el
      # repo en cada corrida. Se redirige a logs/, que esta en .gitignore.
      '--output', 'logs\preverification-ultima.md'
    ) },
  @{ name = 'sync-sea-pertinencia';      args = @() },
  @{ name = 'send-daily-project-report'; args = @() }
)
$weekly = @(
  @{ name = 'sync-sipub-empresas';    args = @() },
  @{ name = 'sync-sipub-centrales';   args = @() },
  @{ name = 'sync-sipub-transmision'; args = @() },
  # -remote y no sync-cne-capacidad.ts a proposito: ese lee un CSV estatico de
  # dataset/, este descarga la version vigente (ver cabecera del script).
  @{ name = 'sync-cne-capacidad-remote'; args = @() },
  @{ name = 'compute-schedule-calibration'; args = @() }
)
# PELP: modelo de expansion del Ministerio de Energia. Cadencia mensual porque
# se publica por version de informe ("Informe Preliminar PELP 2028-2032"), no
# se actualiza a diario. La corrida es idempotente por clave logica.
$monthly = @(
  @{ name = 'sync-pelp'; args = @() }
)

$jobs = switch ($Set) {
  'daily'   { $daily }
  'weekly'  { $weekly }
  'monthly' { $monthly }
  'all'     { $daily + $weekly + $monthly }
}

$logDir = Join-Path $repoRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$started = Get-Date
Write-Output "===== run-syncs [$Set] : $($started.ToString('yyyy-MM-dd HH:mm:ss')) ====="
$results = @()

foreach ($entry in $jobs) {
  $job = $entry.name
  $script = Join-Path $repoRoot "scripts\$job.ts"
  if (-not (Test-Path $script)) {
    Write-Output "[$job] SALTADO - no existe $script"
    $results += [pscustomobject]@{ Job = $job; Exit = 'n/a'; Seg = 0 }
    continue
  }

  $log = Join-Path $logDir "$job.log"
  $t0 = Get-Date
  $argText = if ($entry.args.Count) { ($entry.args | ForEach-Object { "`"$_`"" }) -join ' ' } else { '' }
  Write-Output "[$job] iniciando..."
  Add-Content -Path $log -Value "==== $($t0.ToString('yyyy-MM-dd HH:mm:ss')) ====" -Encoding utf8

  # cmd /c mantiene la redireccion dentro del proceso hijo: evita que
  # PowerShell 5.1 envuelva cada linea de stderr en un ErrorRecord.
  & cmd /c "`"$tsx`" `"$script`" $argText >> `"$log`" 2>&1"
  $code = $LASTEXITCODE
  $seg = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)

  Add-Content -Path $log -Value "---- fin (exit $code, ${seg}s) ----" -Encoding utf8
  $estado = if ($code -eq 0) { 'OK' } else { "FALLO ($code)" }
  Write-Output "[$job] $estado en ${seg}s"
  $results += [pscustomobject]@{ Job = $job; Exit = $code; Seg = $seg }
}

$total = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
Write-Output ""
Write-Output "===== resumen ($total min) ====="
$results | Format-Table -AutoSize | Out-String -Width 120 | Write-Output

$fallidos = @($results | Where-Object { $_.Exit -ne 0 -and $_.Exit -ne 'n/a' })
if ($fallidos.Count -gt 0) {
  $nombres = ($fallidos | ForEach-Object { $_.Job }) -join ', '
  Write-Output "Jobs con error: $nombres. Revisar logs de cada uno en logs\"
  exit 1
}
Write-Output "Todos los jobs terminaron OK."
exit 0
