param([int]$ExcludeProcess = 0, [switch]$Once)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class NovaWindows {
  public struct Rect { public int left, top, right, bottom; }
  public class Window { public string id, app; public bool foreground; public int x, y, width, height; }
  public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr param);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder value, int maximum);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] static extern int GetFrame(IntPtr hwnd, int attr, out Rect rect, int size);
  [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] static extern int GetFlag(IntPtr hwnd, int attr, out int value, int size);
  public static void Initialize() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch {} }
  public static List<Window> Read(int excluded) {
    var windows = new List<Window>(); var shell = GetShellWindow();
    EnumWindows((hwnd, unused) => {
      if (windows.Count >= 80) return false;
      uint pid; GetWindowThreadProcessId(hwnd, out pid);
      if (pid == excluded || hwnd == shell || !IsWindowVisible(hwnd) || IsIconic(hwnd)) return true;
      var name = new StringBuilder(128); GetClassName(hwnd, name, 128);
      if (name.ToString() == "Progman" || name.ToString() == "WorkerW" || name.ToString() == "Shell_TrayWnd"
        || name.ToString() == "Shell_SecondaryTrayWnd") return true;
      if ((GetWindowLong(hwnd, -20) & 0x80) != 0) return true; // tool windows/taskbar
      int cloaked;
      if (GetFlag(hwnd, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      Rect rect;
      if (GetFrame(hwnd, 9, out rect, Marshal.SizeOf(typeof(Rect))) != 0 && !GetWindowRect(hwnd, out rect)) return true;
      int width = rect.right - rect.left, height = rect.bottom - rect.top;
      if (width < 40 || height < 40) return true;
      string app="unknown";
      try { app=System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch {}
      windows.Add(new Window { id = hwnd.ToInt64().ToString(), app=app, foreground=hwnd==GetForegroundWindow(), x = rect.left, y = rect.top, width = width, height = height });
      return true;
    }, IntPtr.Zero);
    return windows;
  }
}
'@
[NovaWindows]::Initialize()
do {
  @{ ok = $true; windows = @([NovaWindows]::Read($ExcludeProcess)) } | ConvertTo-Json -Compress -Depth 4
  if (-not $Once) { Start-Sleep -Milliseconds 400 }
} while (-not $Once)
