'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { menuBounds, ScaledTrayMenu } = require('../src/core/tray-menu.cjs');

test('tray menu scales to its monitor and stays inside mixed-size work areas', () => {
  const template = [{}, {}, {}, {}, { type: 'separator' }, {}, {}, { type: 'separator' }, {}];
  const standard = menuBounds(template, { x: 1910, y: 1040 }, { x: 0, y: 0, width: 1920, height: 1040 }, 1);
  const large = menuBounds(template, { x: -10, y: 2110 }, { x: -3840, y: 0, width: 3840, height: 2110 }, 2.25);
  assert.equal(large.width, standard.width * 2.25);
  assert.equal(large.height, Math.ceil(standard.height * 2.25));
  assert.equal(large.x + large.width, 0);
  assert.equal(large.y + large.height, 2110);
  const small = menuBounds(template, { x: -9999, y: -9999 }, { x: -600, y: -800, width: 600, height: 800 }, 5);
  assert.deepEqual(small, { x: -600, y: -800, width: 600, height: 800, scale: 5 });
});

class FakeWindow extends EventEmitter {
  constructor(options) {
    super(); this.options = options; this.dead = false;
    this.webContents = new EventEmitter();
    Object.assign(this.webContents, { mainFrame: {}, setWindowOpenHandler() {}, send() {} });
  }
  isDestroyed() { return this.dead; }
  loadFile() { return Promise.resolve(); }
  close() { this.dead = true; this.emit('closed'); }
}

test('tray actions require the current menu main frame and toggle only the selected item', () => {
  const ipcMain = new EventEmitter();
  const menu = new ScaledTrayMenu({ BrowserWindow: FakeWindow, ipcMain });
  const calls = [];
  menu.setTemplate([{ type: 'checkbox', checked: false, click: item => calls.push(item.checked) },
    { type: 'separator' }, { enabled: false, click: () => calls.push('disabled') }]);
  menu.open({ x: 100, y: 100 }, { x: 0, y: 0, width: 1920, height: 1080 }, 2.25);
  const window = menu.window;
  assert.equal(window.options.webPreferences.zoomFactor, 2.25);
  assert.equal(window.options.webPreferences.sandbox, true);
  const sender = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  ipcMain.emit('nova:tray-menu-action', { sender: {} }, 0);
  ipcMain.emit('nova:tray-menu-action', { ...sender, senderFrame: {} }, 0);
  for (const index of [1, 2, -1, 999, '0']) ipcMain.emit('nova:tray-menu-action', sender, index);
  assert.deepEqual(calls, []);
  ipcMain.emit('nova:tray-menu-action', sender, 0);
  ipcMain.emit('nova:tray-menu-action', sender, 0);
  assert.deepEqual(calls, [true]);
  assert.equal(menu.window, null);
  menu.dispose();
  assert.equal(ipcMain.listenerCount('nova:tray-menu-action'), 0);
});
