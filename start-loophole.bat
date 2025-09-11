@echo off
REM ============================================================
REM Addon Stremio + Node.js + Loophole con cuenta atrás visual
REM ============================================================

SETLOCAL ENABLEDELAYEDEXPANSION
SET NODE_PROJECT_DIR=%~dp0

REM Entrar a la carpeta del proyecto
cd /d "%NODE_PROJECT_DIR%"

REM Iniciar Node.js
echo Iniciando addon Node.js...
start cmd /k "npm start"

REM Cuenta atrás de 5 segundos antes de lanzar Loophole
SET contador=5

:cuenta
<nul set /p =Espera de !contador! segundos antes de iniciar Loophole... 
timeout /t 1 >nul
SET /a contador-=1
IF !contador! GEQ 0 (
    <nul set /p =[1G
    goto cuenta
)

echo.
REM Iniciar Loophole Tunnel (en puerto {PON_AQUI_TU_PUERTO})
echo Iniciando Loophole Tunnel...
start cmd /k "loophole http {PON_AQUI_TU_PUERTO} --hostname {PON_AQUI_TU_SUBDOMINIO_LOOPHOLE}.loophole.site"

timeout /t 2 >nul

echo ============================================================
echo Todo iniciado. Copia la URL HTTPS que aparezca en loophole
echo y pégala en Stremio para añadir el addon.
echo ============================================================
pause
