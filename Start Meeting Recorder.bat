@echo off
setlocal
set "PROJECT_DIR=C:\Users\Valdemir Goncalves\Downloads\meeting-recorder\meeting-recorder"

echo ========================================
echo Meeting Recorder + Compressor Launcher
echo ========================================
echo.

if not exist "%PROJECT_DIR%\server\package.json" (
  echo ERROR: Server folder was not found.
  echo Expected:
  echo %PROJECT_DIR%\server
  pause
  exit /b 1
)

if not exist "%PROJECT_DIR%\client\package.json" (
  echo ERROR: Client folder was not found.
  echo Expected:
  echo %PROJECT_DIR%\client
  pause
  exit /b 1
)

echo Starting backend server...
start "Meeting Recorder Server" cmd /k "cd /d ""%PROJECT_DIR%\server"" && npm install && npm run dev"

timeout /t 6 /nobreak >nul

echo Starting frontend client...
start "Meeting Recorder Client" cmd /k "cd /d ""%PROJECT_DIR%\client"" && npm install && npm run dev"

timeout /t 8 /nobreak >nul

echo Opening browser...
start "" "http://localhost:5173"

echo.
echo Done. You can close this launcher window.
timeout /t 3 /nobreak >nul
exit
