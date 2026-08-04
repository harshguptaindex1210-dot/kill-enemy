@echo off
cd /d "C:\Users\Harsh\Desktop\Work\Shooter Game"
echo Starting game server...
start cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
start http://localhost:5173
echo Browser should open at http://localhost:5173
echo If not, open it manually.
pause
