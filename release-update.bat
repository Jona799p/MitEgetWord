@echo off
title MitEgetWord - Frigiv Ny Opdatering
color 0b

echo ========================================================
echo        MITEGETWORD - AUTOMATISK OPDATERING
echo ========================================================
echo.

:: 1. Vis nuvaerende version
for /f "tokens=*" %%i in ('node scripts/bump-version.cjs peek') do set JSON_INFO=%%i

echo Finder nuvaerende versionsnummer...
echo.

:: 2. Spoerg brugeren om opdateringstype
echo Vaelg hvilken type opdatering du vil udgive:
echo   [1] Almindelig fejlrettelse / QoL (f.eks. v1.0.0 -^> v1.0.1) - STANDARD
echo   [2] Ny stoerre funktion        (f.eks. v1.0.0 -^> v1.1.0)
echo   [3] Major udgivelse            (f.eks. v1.0.0 -^> v2.0.0)
echo.
set /p CHOICE="Tryk 1, 2 eller 3 (eller tryk blot ENTER for standard [1]): "

set BUMP_TYPE=patch
if "%CHOICE%"=="2" set BUMP_TYPE=minor
if "%CHOICE%"=="3" set BUMP_TYPE=major

echo.
echo [1/3] Opgraderer automatisk versionsnummer i package.json...
node scripts/bump-version.cjs %BUMP_TYPE%
if %errorlevel% neq 0 (
    color 0c
    echo [FEJL] Kunne ikke opdatere versionsnummer.
    pause
    exit /b 1
)

echo.
echo [2/3] Bygger installationsfilen (.exe) med det nye versionsnummer...
echo Dette tager ca. 1 minut...
call npm run electron:build
if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [FEJL] Byggeprocessen fejlede! Tjek venligst fejlene ovenfor.
    pause
    exit /b 1
)

echo.
echo [3/3] Udgiver automatisk opdateringen til serveren og Skrivebordet...
node scripts/publish-update.cjs
if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [FEJL] Kunne ikke udgive opdateringsfilerne.
    pause
    exit /b 1
)

echo.
color 0a
echo ========================================================
echo [SUCCES] Opdateringen er udgivet!
echo.
echo 1. Filen ligger nu i server/updates/ paa serveren.
echo 2. Klient-computerne vil hente opdateringen helt automatisk.
echo 3. Den nyeste installationspakke er ogsaa opdateret paa dit Skrivebord.
echo ========================================================
echo.
pause
