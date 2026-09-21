@echo off
title MitEgetWord - Frigiv Ny Opdatering
color 0b

echo ========================================================
echo        MITEGETWORD - AUTOMATISK OPDATERING
echo ========================================================
echo.

:: 1. Spoerg brugeren om opdateringstype
echo Vaelg hvilken type opdatering du vil udgive:
echo   [1] Fejlrettelse / Lille opdatering (f.eks. v1.0.10 -^> v1.0.11) - STANDARD
echo   [2] Ny stoerre funktion            (f.eks. v1.0.10 -^> v1.1.0)
echo   [3] Major udgivelse                (f.eks. v1.0.10 -^> v2.0.0)
echo.
set /p BUMP_CHOICE="Tryk 1, 2 eller 3 (eller tryk blot ENTER for standard [1]): "

set BUMP_TYPE=patch
if "%BUMP_CHOICE%"=="2" set BUMP_TYPE=minor
if "%BUMP_CHOICE%"=="3" set BUMP_TYPE=major

echo.
echo Vaelg metode for udgivelse:
echo   [1] Fuld udgivelse: Byg .exe lokalt + GitHub Release + Server synk (STANDARD)
echo   [2] Lyn-Udgivelse via GitHub Actions (GitHub bygger .exe i skyen)
echo   [3] Kun synkroniser server backend-kode til Server-PC (ingen ny .exe)
echo.
set /p METHOD_CHOICE="Tryk 1, 2 eller 3 (eller tryk blot ENTER for standard [1]): "

if "%METHOD_CHOICE%"=="3" (
    echo.
    echo Synkroniserer server backend-kode til Server-PC...
    node scripts/deploy-server.cjs
    pause
    exit /b 0
)

echo.
echo [1/3] Opgraderer automatisk versionsnummer i package.json...
node scripts/bump-version.cjs %BUMP_TYPE%
if %errorlevel% neq 0 (
    color 0c
    echo [FEJL] Kunne ikke opdatere versionsnummer.
    pause
    exit /b 1
)

if "%METHOD_CHOICE%"=="2" (
    echo.
    echo [2/3] Pusher release og tag til GitHub for Cloud-byg...
    node scripts/git-release.cjs
    echo.
    echo [3/3] Synkroniserer server-kode til Server-PC...
    node scripts/deploy-server.cjs
    echo.
    color 0a
    echo ========================================================
    echo [SUCCES] Koden er afsendt til GitHub Actions!
    echo Installationspakken bliver automatisk bygget i skyen.
    echo ========================================================
    pause
    exit /b 0
)

echo.
echo [2/3] Bygger installationsfilen (.exe) lokalt med det nye versionsnummer...
echo Dette tager ca. 1-2 minutter...
call npm run electron:build
if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [FEJL] Byggeprocessen fejlede! Tjek venligst fejlene ovenfor.
    pause
    exit /b 1
)

echo.
echo [3/3] Udgiver opdateringen til GitHub, Server-PC og Skrivebord...
node scripts/publish-update.cjs
if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [FEJL] Kunne ikke udgive opdateringsfilerne.
    pause
    exit /b 1
)

echo.
echo Registrerer tag og forbereder GitHub synkronisering...
node scripts/git-release.cjs

echo.
color 0a
echo ========================================================
echo [SUCCES] Opdateringen er udgivet og klar!
echo.
echo 1. Installationsfilen er klar paa Skrivebordet.
echo 2. Server-PC'en paa 100.126.133.31 er opdateret.
echo 3. GitHub repository er opdateret.
echo ========================================================
echo.
pause

