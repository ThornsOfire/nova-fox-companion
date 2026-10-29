'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const execute = promisify(execFile);
function allowedWindow(sample, id, excluded, now = Date.now()) {
  if (!sample?.available || now - sample.timestamp > 2200 || !/^\d{1,20}$/.test(String(id))) return null;
  const window = sample.windows.find((value) => value.id === id);
  if (!window || !window.app || window.app === 'unknown' || excluded.includes(window.app.toLowerCase())) return null;
  return window;
}
async function captureWindow({ script, window, signal, execImpl = execute }) {
  if (!window || !/^\d{1,20}$/.test(window.id) || !/^[\w .-]{1,80}$/.test(window.app)) throw new Error('Unavailable target');
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = await execImpl(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', script, '-WindowId', window.id, '-ExpectedProcess', window.app],
  { windowsHide: true, timeout: 5000, maxBuffer: 2 * 1024 * 1024, signal });
  const base64 = stdout.trim();
  if (base64.length < 32 || base64.length > 1500000 || !/^[A-Za-z0-9+/=]+$/.test(base64)
    || !Buffer.from(base64, 'base64').subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('Capture did not return a PNG');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 24 || bytes.readUInt32BE(16) > 512 || bytes.readUInt32BE(20) > 512
    || bytes.readUInt32BE(16) < 1 || bytes.readUInt32BE(20) < 1) throw new Error('Capture exceeds its size limit');
  return `data:image/png;base64,${base64}`;
}
module.exports = { allowedWindow, captureWindow };
