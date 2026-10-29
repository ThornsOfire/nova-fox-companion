param([long]$WindowId, [string]$ExpectedProcess, [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class NovaCapture {
  public struct Rect { public int left, top, right, bottom; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr window, IntPtr context, uint flags);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  public static string Read(long id, string expected) {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch {}
    var window = new IntPtr(id); Rect rect; uint pid;
    GetWindowThreadProcessId(window, out pid);
    if (!String.Equals(Process.GetProcessById((int)pid).ProcessName, expected, StringComparison.OrdinalIgnoreCase)) throw new Exception("Window changed");
    if (!IsWindowVisible(window) || IsIconic(window) || !GetWindowRect(window, out rect)) throw new Exception("Unavailable window");
    int width = rect.right-rect.left, height = rect.bottom-rect.top;
    if (width < 40 || height < 40 || width > 8192 || height > 8192 || (long)width*height > 16000000) throw new Exception("Invalid dimensions");
    using (var bitmap = new Bitmap(width, height, PixelFormat.Format24bppRgb)) {
      using (var graphics = Graphics.FromImage(bitmap)) {
        var context = graphics.GetHdc(); bool rendered;
        try { rendered = PrintWindow(window, context, 2); } finally { graphics.ReleaseHdc(context); }
        if (!rendered) throw new Exception("Window does not support capture");
      }
      int minimum = 255, maximum = 0;
      for (int y=0;y<height;y+=Math.Max(1,height/20)) for(int x=0;x<width;x+=Math.Max(1,width/20)) {
        var color=bitmap.GetPixel(x,y); int brightness=(color.R+color.G+color.B)/3;
        minimum=Math.Min(minimum,brightness); maximum=Math.Max(maximum,brightness);
      }
      if (maximum-minimum < 3) throw new Exception("Empty or protected capture");
      double ratio=Math.Min(1.0,512.0/Math.Max(width,height));
      using (var resized=new Bitmap(bitmap, Math.Max(1,(int)(width*ratio)), Math.Max(1,(int)(height*ratio))))
      using (var stream=new MemoryStream()) {
        resized.Save(stream,ImageFormat.Png); return Convert.ToBase64String(stream.ToArray());
      }
    }
  }
}
'@
if ($ValidateOnly) { 'Capture helper compiled; no window captured.' }
else { [NovaCapture]::Read($WindowId, $ExpectedProcess) }
