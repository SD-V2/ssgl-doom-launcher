@echo off
echo Right-click this file and choose "Run as administrator" if you get a "privilege" error.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-SSGL.ps1"
pause
