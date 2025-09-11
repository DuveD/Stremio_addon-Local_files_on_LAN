@echo off
REM ============================================================
REM Iniciar Addon Node.js para Stremio en LAN
REM ============================================================

REM Carpeta donde está este .bat
SET NODE_PROJECT_DIR=%~dp0

cd /d "%NODE_PROJECT_DIR%"

echo Iniciando addon Node.js...
start cmd /k "npm start"

echo ============================================================
echo Addon iniciado.
echo Abre Stremio y usa la URL http://<IP_LOCAL>:7000/manifest.json
echo donde <IP_LOCAL> es la IP que aparece en la consola.
echo ============================================================
pause
