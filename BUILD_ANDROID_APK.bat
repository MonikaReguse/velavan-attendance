@echo off
title Velavan Attendance - Android APK Builder
echo ========================================================
echo   Velavan Properties - Android APK Compilation Script
echo ========================================================
echo.

set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk

echo [1/4] Checking Java and Android SDK...
if not exist "%JAVA_HOME%\bin\java.exe" (
    echo Error: Java not found at %JAVA_HOME%
    pause
    exit /b 1
)

echo [2/4] Building React Web Assets...
cd /d "%~dp0admin-app"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo [3/4] Syncing Assets with Capacitor Android...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo Capacitor sync failed!
    pause
    exit /b 1
)

echo [4/4] Compiling Android APK with Gradle...
cd /d "%~dp0admin-app\android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo APK build failed!
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   SUCCESS: APK Built Successfully!
echo ========================================================
echo The APK file is located at:
echo %~dp0admin-app\android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
