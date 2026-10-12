@echo off
cd /d "%~dp0"
echo ========================================================
echo Starting Pure for Cure (Hare Krishna Mandir Guwahati)
echo Local Web Server on http://localhost:8000
echo ========================================================
python -m http.server 8000
pause
