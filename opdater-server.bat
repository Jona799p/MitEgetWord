@echo off
title MitEgetWord - Opdater Server PC Kode
color 0b

echo ========================================================
echo       MITEGETWORD - SYNKRONISER SERVER PC KODE
echo ========================================================
echo.
echo Synkroniserer backend-kode, AI-ruter og indstillinger til:
echo   \\100.126.133.31\Users\jonas\Desktop\Server
echo.
echo (Dine gemte dokumenter og config.json beroeres IKKE)
echo.

node scripts/deploy-server.cjs

if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [FEJL] Synkronisering fejlede! Tjek venligst netvaerksforbindelsen.
    pause
    exit /b 1
)

echo.
color 0a
pause
