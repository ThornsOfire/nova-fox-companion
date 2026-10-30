'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

function cleanWindows(value, convert = (rect) => rect) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).flatMap((item) => {
    if (!item || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(item[key]))
      || item.width < 1 || item.height < 1 || item.width > 100000 || item.height > 100000) return [];
    const rect = convert({ x: item.x, y: item.y, width: item.width, height: item.height });
    return [{ ...rect, id: String(item.id || '').slice(0, 32), foreground: item.foreground === true,
      app: typeof item.app === 'string' && /^[\w .-]{1,80}$/.test(item.app) ? item.app.toLowerCase() : 'unknown' }];
  });
}

class DesktopSensor {
  constructor({ script, excludePid = process.pid, convert, onSample, spawnImpl = spawn }) {
    this.script = script; this.excludePid = excludePid; this.convert = convert;
    this.onSample = onSample; this.spawn = spawnImpl; this.child = null; this.stopped = false;
    this.retry = null;
  }
  start() {
    if (this.child || this.stopped || process.platform !== 'win32') return;
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child = this.spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.script,
      '-ExcludeProcess', String(this.excludePid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    this.child = child;
    let pending = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      pending += chunk;
      if (pending.length > 100000) { pending = ''; return; }
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        try {
          const sample = JSON.parse(line);
          if (sample.ok === true) this.onSample({ available: true, windows: cleanWindows(sample.windows, this.convert), scales: (sample.scales || []).filter(d => [d.x,d.y,d.width,d.height,d.scaleFactor].every(Number.isFinite) && d.scaleFactor >= 1 && d.scaleFactor <= 5).slice(0,16), timestamp: Date.now() });
        } catch { /* Malformed native samples never reach the renderer. */ }
      }
    });
    const failed = () => {
      if (this.child !== child) return;
      this.child = null;
      this.onSample({ available: false, windows: [], timestamp: Date.now() });
      if (!this.stopped) this.retry = setTimeout(() => { this.retry = null; this.start(); }, 5000);
    };
    child.on('error', failed); child.on('exit', failed);
  }
  stop() { this.stopped = true; if (this.retry) clearTimeout(this.retry); const child = this.child; this.child = null; child?.kill(); }
}

module.exports = { DesktopSensor, cleanWindows };
