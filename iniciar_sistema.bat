@echo off
echo ===================================================
echo   CONTROLE DE REUS - INICIANDO SISTEMA
echo ===================================================
echo.
echo Por favor, nao feche esta janela enquanto usar o sistema.
echo.
echo 1. Iniciando servidor...
cd /d "%~dp0"

start "" "http://localhost:3000"
npm run dev
pause
