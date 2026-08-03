@echo off
setlocal
cd /d "%~dp0.."
if not exist logs mkdir logs
echo ==== %date% %time% ==== >> logs\sync-listado.log
call npx tsx scripts\sync-listado.ts >> logs\sync-listado.log 2>&1
echo ---- fin (exit %errorlevel%) ---- >> logs\sync-listado.log
endlocal
