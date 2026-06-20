@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fui.ps1" %*
