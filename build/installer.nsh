!include "WinMessages.nsh"

!macro customInstall
  DetailPrint "Enabling Nova Fox Companion lifecycle hooks"
  WriteRegExpandStr HKCU "Environment" "NOVA_FOX_COMPANION_APP" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --install-hooks' $0
  DetailPrint "Nova Fox Companion integration exit code: $0"
!macroend

!macro customUnInstall
  DetailPrint "Removing Nova Fox Companion lifecycle hooks"
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --uninstall-hooks' $0
  ReadRegStr $1 HKCU "Environment" "NOVA_FOX_COMPANION_APP"
  StrCmp $1 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 +2
  DeleteRegValue HKCU "Environment" "NOVA_FOX_COMPANION_APP"
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend
