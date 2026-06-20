!macro customInstall
  DetailPrint "Configuring fui terminal command"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\cli\win\install-fui-path.ps1" "$INSTDIR"'
!macroend
