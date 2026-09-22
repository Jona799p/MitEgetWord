@echo off
title MitEgetWord Server Hub
color 0b

echo ========================================================
echo        MITEGETWORD SERVER PC HOSTING HUB
echo ========================================================
echo.

:: 1. Tjek om Node.js er installeret
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [FEJL] Node.js blev ikke fundet!
    echo Installer venligst Node.js fra https://nodejs.org for at koere serveren.
    echo.
    pause
    exit /b 1
)

:: 2. Vis Serverens IP-adresser
echo [INFO] Finder serverens lokale IP-adresse...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    echo   -> Fundet IP: %%a
)
echo.

:: 3. Tjek om Ollama koerer paa server-pc'en
echo [INFO] Tjekker lokal AI (Ollama)...
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Ollama koerer og er klar til AI-anmodninger!
) else (
    echo [BEMAERK] Ollama koerer ikke paa standardporten 11434.
    echo Hvis du vil bruge lokal AI, skal du starte Ollama paa denne pc.
)
echo.

:: 4. Start backend serveren
echo [INFO] Starter MitEgetWord Server Hub paa port 3000...
echo Tast Ctrl+C for at stoppe serveren.
echo ========================================================
echo.

:serverloop
node --max-old-space-size=4096 server/index.cjs

echo.
echo [INFO] Serveren genstarter om 2 sekunder...
timeout /t 2 /nobreak >nul
goto serverloop
