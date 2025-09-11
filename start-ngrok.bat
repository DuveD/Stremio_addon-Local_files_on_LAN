@echo off
REM ============================================================
REM Addon Stremio + Node.js + ngrok con cuenta atrás visual
REM ============================================================

SETLOCAL ENABLEDELAYEDEXPANSION
SET NODE_PROJECT_DIR=%~dp0

REM Entrar a la carpeta del proyecto
cd /d "%NODE_PROJECT_DIR%"

REM Iniciar Node.js
echo Iniciando addon Node.js...
start cmd /k "npm start"

REM Cuenta atrás de 5 segundos antes de lanzar ngrok
SET contador=5

:cuenta
<nul set /p =Espera de !contador! segundos antes de iniciar ngrok... 
timeout /t 1 >nul
SET /a contador-=1
IF !contador! GEQ 0 (
    <nul set /p =[1G
    goto cuenta
)

echo.
REM Iniciar ngrok con tu URL estática
echo Iniciando ngrok...
start cmd /k "ngrok http {PON_AQUI_TU_PUERTO}"

timeout /t 2 >nul

echo ============================================================
echo Todo iniciado. Copia la URL HTTPS que aparezca en ngrok
echo y pégala en Stremio para añadir el addon.
echo ============================================================
pause
