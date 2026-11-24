@echo off
:loop
echo Tizim ishga tushmoqda...
node start-all.js
echo Tizim to'xtadi (yoki tunnel URL almashdi), 2 soniyadan keyin qayta ishga tushadi...
timeout /t 2 /nobreak
goto loop
