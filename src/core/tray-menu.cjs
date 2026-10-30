'use strict';
const path = require('node:path');
const ACTION = 'nova:tray-menu-action';
const CONTENT = 'nova:tray-menu-content';

function menuBounds(template, point, workArea, scale) {
  scale = Number.isFinite(scale) ? Math.max(1, Math.min(5, scale)) : 1;
  const width = Math.min(workArea.width, Math.ceil(320 * scale));
  const height = Math.min(workArea.height, Math.ceil((18 + template.reduce((sum, item) => sum + (item.type === 'separator' ? 13 : 38), 0)) * scale));
  return { x: Math.round(Math.max(workArea.x, Math.min(point.x, workArea.x + workArea.width - width))),
    y: Math.round(Math.max(workArea.y, Math.min(point.y, workArea.y + workArea.height - height))),
    width, height, scale };
}

class ScaledTrayMenu {
  constructor({ BrowserWindow, ipcMain }) {
    this.BrowserWindow = BrowserWindow; this.ipcMain = ipcMain;
    this.window = null; this.template = [];
    this.onAction = (event, index) => {
      const window = this.window;
      if (!window || window.isDestroyed() || event.sender !== window.webContents
        || event.senderFrame !== window.webContents.mainFrame) return;
      if (index === 'close') { window.close(); return; }
      if (!Number.isInteger(index)) return;
      const item = this.template[index];
      if (!item || item.type === 'separator' || item.enabled === false || typeof item.click !== 'function') return;
      window.close();
      item.click({ checked: item.type === 'checkbox' ? !item.checked : false });
    };
    ipcMain.on(ACTION, this.onAction);
  }
  setTemplate(template) { this.template = template; this.window?.close(); }
  open(point, workArea, scale) {
    this.window?.close();
    const { scale: zoomFactor, ...bounds } = menuBounds(this.template, point, workArea, scale);
    const window = new this.BrowserWindow({ ...bounds, show: false, frame: false, resizable: false,
      skipTaskbar: true, alwaysOnTop: true, minimizable: false, maximizable: false,
      backgroundColor: '#202124', webPreferences: { preload: path.join(__dirname, '../preload-tray.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, zoomFactor } });
    this.window = window;
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.once('did-finish-load', () => {
      if (window.isDestroyed()) return;
      window.webContents.send(CONTENT, this.template.map(item => ({ label: item.label || '', type: item.type || 'normal',
        checked: Boolean(item.checked), enabled: item.enabled !== false })));
      window.show(); window.focus();
    });
    window.on('blur', () => window.close());
    window.on('closed', () => { if (this.window === window) this.window = null; });
    void window.loadFile(path.join(__dirname, '../renderer/tray-menu.html')).catch(() => {
      if (!window.isDestroyed()) window.close();
    });
  }
  dispose() { this.window?.close(); this.ipcMain.removeListener(ACTION, this.onAction); }
}
module.exports = { menuBounds, ScaledTrayMenu };
