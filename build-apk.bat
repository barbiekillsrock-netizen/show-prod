@echo off
echo ========================================
echo  ShowProd - Gerando APK
echo ========================================

cd /d D:\show-prod

echo.
echo [1/4] Baixando atualizacoes...
git pull origin main

echo.
echo [2/4] Compilando o app...
call npm run build:spa
if errorlevel 1 (
    echo ERRO no build!
    pause
    exit /b 1
)

echo.
echo [3/4] Sincronizando com Android...
call npx cap sync android
if errorlevel 1 (
    echo ERRO no sync!
    pause
    exit /b 1
)

echo.
echo [4/4] Gerando APK...
cd /d D:\show-prod\android
set JAVA_HOME=C:\Users\Mari\.jdks\jbr-21.0.11
set PATH=%JAVA_HOME%\bin;%PATH%
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo ERRO no build Android!
    pause
    exit /b 1
)

echo.
echo ========================================
echo  APK gerado com sucesso!
echo  Local: D:\show-prod\android\app\build\outputs\apk\debug\
echo ========================================
pause
