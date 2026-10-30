'use strict';
// Isolated, invisible fixture: no tray icon, live profile, provider calls, or system input.
process.on('uncaughtException', error => { console.error(error); process.exit(1); });
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { ScaledTrayMenu } = require('../src/core/tray-menu.cjs');
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (!output || !path.isAbsolute(output)) throw Error('An absolute synthetic output directory is required');
require('node:fs').mkdirSync(path.join(output, 'synthetic-tray-profile'), { recursive: true });
app.setPath('userData', path.join(output, 'synthetic-tray-profile'));
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('disable-background-networking');
app.disableHardwareAcceleration();
let focused = 0;
app.on('browser-window-focus', () => focused++);
app.on('browser-window-created', (_event, window) => {
  window.setFocusable(false); window.setAlwaysOnTop(false);
  window.show = window.showInactive = window.focus = () => {};
});
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const menu = new ScaledTrayMenu({ BrowserWindow, ipcMain });
  const watchdog = setTimeout(() => { console.error('Tray fixture timed out'); menu.dispose(); app.exit(1); }, 15000);
  try {
    await fs.mkdir(output, { recursive: true });
    const items = [{ label: 'Open settings' }, { label: 'Mute companion voice', type: 'checkbox', checked: true },
      { label: 'Disable avatars' }, { label: 'Passive mode (click-through)', type: 'checkbox' },
      { type: 'separator' }, { label: 'Run demo' }, { label: 'Refresh avatars' }, { type: 'separator' }, { label: 'Quit' }];
    const results = [];
    for (const scale of [1, 2.25]) {
      menu.setTemplate(items);
      menu.open({ x: 3835, y: 2065 }, { x: 0, y: 0, width: 3840, height: 2070 }, scale);
      const win = menu.window;
      await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
      console.log('Loaded tray scale ' + scale);
      await new Promise(resolve => setTimeout(resolve, 250));
      const state = await win.webContents.executeJavaScript(`({ count: document.querySelectorAll('button').length,
        checked: document.querySelector('[role="menuitemcheckbox"]').getAttribute('aria-checked'),
        first: document.activeElement.textContent.trim(), width: innerWidth,
        scrolls: document.querySelector('#menu').scrollHeight > document.querySelector('#menu').clientHeight })`);
      assert.equal(state.count, 7); assert.equal(state.checked, 'true'); assert.equal(state.first, 'Open settings');
      assert.equal(state.scrolls, false);
      await win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))`);
      assert.equal(await win.webContents.executeJavaScript('document.activeElement.textContent.trim()'), 'Quit');
      await win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))`);
      assert.equal(await win.webContents.executeJavaScript('document.activeElement.textContent.trim()'), 'Open settings');
      await win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))`);
      assert.equal(await win.webContents.executeJavaScript('document.activeElement.textContent.trim()'), '✓Mute companion voice');
      console.log('Keyboard and contents checked at ' + scale);
      const image = await win.webContents.capturePage(undefined, { stayHidden: true });
      await fs.writeFile(path.join(output, `tray-${scale}.png`), image.toPNG());
      console.log('Captured hidden tray scale ' + scale);
      results.push({ scale, zoom: win.webContents.getZoomFactor(), bounds: win.getBounds(), state, visible: win.isVisible() });
      const closed = new Promise(resolve => win.once('closed', resolve));
      void win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`).catch(() => {});
      await closed;
    }
    assert.equal(focused, 0);
    await fs.writeFile(path.join(output, 'tray-scaling.json'), JSON.stringify({ results, focusEvents: focused,
      keyboard: 'Home/End/ArrowDown/Escape passed through renderer; no OS input injected', cleanExit: true }, null, 2));
    clearTimeout(watchdog); menu.dispose(); app.quit();
  } catch (error) { clearTimeout(watchdog); console.error(error); menu.dispose(); app.exit(1); }
});
