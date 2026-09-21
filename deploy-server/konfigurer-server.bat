@echo off
title MitEgetWord - Konfigurer Server API'er
color 0e

echo ========================================================
echo       MITEGETWORD - SERVER API KONFIGURATION
echo ========================================================
echo.
echo Her kan du indstille hvilke API'er serveren skal bruge:
echo  - activeProvider: Vaelg mellem ollama, gemini, openai, anthropic, groq, deepseek, custom
echo  - Indtast dine API-noegler og foretrukne modeller
echo.
echo Serverens konfigurationsfil (server/config.json) aabnes nu i Notesblok...
echo.

if not exist server\config.json (
    echo [FEJL] Fandt ikke server/config.json!
    pause
    exit /b 1
)

start notepad.exe server\config.json

echo Naar du har aendret dine noegler/modeller i Notesblok:
echo 1. Gem filen (Ctrl + S) i Notesblok og luk den.
echo 2. Genstart serveren (hvis den allerede koerer) for at anvende de nye noegler.
echo ========================================================
echo.
pause
