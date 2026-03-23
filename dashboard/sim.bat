@echo off
cd /d %~dp0
set ROBOT_HOST=localhost
echo Installing dependencies...
call npm install
echo Starting dashboard...
call npm start
pause
