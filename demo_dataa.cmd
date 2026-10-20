@echo off
rem Lance la démonstration DATA'A (données fictives) : serveur, page de connexion, code usine.
rem Double-cliquer ce fichier. Fermer les fenêtres pour tout arrêter.
chcp 65001 >nul
set "UV=%USERPROFILE%\.local\bin\uv.exe"
set "OPENBLAS_NUM_THREADS=1"
cd /d "%~dp0backend"

if not exist "%~dp0web\dist\index.html" (
  echo Construction de l'interface...
  pushd "%~dp0web" && call pnpm run build && popd
)

start "DATA'A - serveur de demonstration" cmd /k ""%UV%" run --no-sync python -m plateforme.saas.serveur_demo --web ../web/dist"
start "DATA'A - code usine" cmd /k ""%UV%" run --no-sync python -m plateforme.saas.code_usine"

echo Demarrage du serveur (environ 30 secondes)...
:attendre
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/logo_data_a.png).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto attendre

start "" "http://127.0.0.1:8765/connexion"
echo.
echo DATA'A est ouvert dans le navigateur : http://127.0.0.1:8765
echo   Usine    : usine@demo.invalid           (code a 6 chiffres : fenetre "code usine")
echo   Client A : admin@client-a.demo.invalid
echo   Client B : admin@client-b.demo.invalid
echo   Mot de passe (tous) : Demo-DATAA-2026
echo.
pause
