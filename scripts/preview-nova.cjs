'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { readAvatarPackage } = require('../src/core/avatar-library.cjs');
const { normalizeSettings } = require('../src/core/settings-store.cjs');
const scene = process.argv.find((value) => value.startsWith('--scene='))?.slice(8) || 'chat';
const scenes = ['chat', 'sleep', 'peek', 'play', 'escape', 'fullscreen'];
if (!scenes.includes(scene)) throw new Error('Unknown preview scene');
const root = path.join(__dirname, '..');
app.setPath('userData', path.join(root, 'work', 'isolated-render-preview'));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const avatar = await readAvatarPackage(path.join(root, 'assets', 'avatars', 'nova-spirit-fox'), 'bundled');
  avatar.assetUrl = pathToFileURL(avatar.spritesheetPath).toString();
  const settings = normalizeSettings({ singleCompanion: true, enabledAvatarIds: [avatar.id],
    companionVoiceMuted: true, companionCloudEnabled: true, showLabels: false, mainAvatarSize: 150,
    reducedMotion: scene === 'chat' });
  const state = { sessions: [{ id: '11111111-1111-4111-8111-111111111111', agents: [{ id: 'root', label: 'Preview agent', status: 'idle', isRoot: true }] }] };
  const zone = { zones: [{ x: 0, y: 0, width: 1000, height: 740 }] };
  ipcMain.handle('fixture:bootstrap', () => ({ settings, state, zone, avatars: [avatar] }));
  const window = new BrowserWindow({ width: 1000, height: 740, show: false, transparent: true,
    frame: false, webPreferences: { preload: path.join(__dirname, 'preview-nova-preload.cjs'), contextIsolation: true, sandbox: false, backgroundThrottling: false } });
  const errors = [];
  window.webContents.on('console-message', (_event, ...args) => {
    const detail = args.find((value) => typeof value === 'object' && value?.level === 'error');
    if (detail) errors.push(detail.message);
  });
  await window.loadFile(path.join(root, 'src', 'renderer', 'overlay.html'));
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 180));
  const desktop = { available: true, timestamp: Date.now(), cursor: { x: 620, y: 455 }, idleMs: 0, moved: false,
    windows: [], safeZones: zone.zones, blocked: [] };
  window.webContents.send('fixture:desktop', desktop);
  await window.webContents.executeJavaScript(`(() => {
    const actor = actors.values().next().value;
    if (!actor) throw new Error('Resident Nova was not rendered');
    actor.x = 570; actor.y = 390; actor.targetX = 570; actor.targetY = 390;
  })()`);
  if (scene === 'chat') {
    await window.webContents.executeJavaScript(`document.querySelector('.companion-spirit').click()`);
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('.companion-chat-line input');
      input.value = 'Hello Nova'; document.querySelector('.companion-chat-line').requestSubmit();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const result = await window.webContents.executeJavaScript(`({open:!document.querySelector('.companion-chat').hidden,
      text:document.querySelector('.companion-history').textContent,
      height:document.querySelector('.companion-history').clientHeight,
      scrollHeight:document.querySelector('.companion-history').scrollHeight})`);
    assert.equal(result.open, true); assert.match(result.text, /Hello Nova/); assert.match(result.text, /ears are operational/);
    assert.ok(result.scrollHeight > result.height);
  }
  if (scene === 'peek') {
    desktop.windows = [{ id: 'synthetic', x: 170, y: 180, width: 400, height: 300 }]; desktop.idleMs = 9000;
    await window.webContents.executeJavaScript(`(() => {const mock=document.createElement('div');
      mock.style.cssText='position:fixed;left:170px;top:180px;width:400px;height:300px;border-radius:12px;background:#273442;color:#b4cbdc;padding:20px;font:14px system-ui;z-index:-1';
      mock.textContent='Synthetic window · preview only';document.body.append(mock);})()`);
    await window.webContents.executeJavaScript(`(() => {const a=actors.values().next().value; a.x=502.5; a.y=204;})()`);
  }
  if (scene === 'play') desktop.idleMs = 9000;
  if (scene === 'escape') {
    await window.webContents.executeJavaScript(`(() => { const a=actors.values().next().value;
      for(let i=0;i<3;i++) a.playState.pickup(Date.now()); a.playState.drop(Date.now()); })()`);
  }
  if (scene === 'fullscreen') desktop.safeZones = [];
  window.webContents.send('fixture:desktop', desktop);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const details = await window.webContents.executeJavaScript(`({sleeping:document.querySelector('.avatar').classList.contains('is-sleeping'),
    mode:actors.values().next().value.playState.mode, decoy:!document.querySelector('.cursor-decoy').hidden,
    hidden:document.querySelector('#world').hidden, frame:document.querySelector('.sprite-art').style.backgroundPosition,
    sensorSeen: desktop?.idleMs, zones: desktop?.safeZones.length, reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches})`);
  process.stdout.write(`Scene state: ${JSON.stringify(details)}\n`);
  if (scene === 'sleep') assert.equal(details.sleeping, true);
  if (scene === 'peek') assert.equal(details.mode, 'peek');
  if (scene === 'play') assert.equal(details.decoy, true);
  if (scene === 'escape') assert.equal(details.mode, 'escape');
  if (scene === 'fullscreen') assert.equal(details.hidden, true);
  if (scene !== 'fullscreen') assert.ok(details.frame);
  const output = path.join(root, 'artifacts', `nova-${scene}.png`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, (await window.webContents.capturePage()).toPNG());
  if (scene === 'chat' || scene === 'sleep') {
    const bounds = await window.webContents.executeJavaScript(`(() => {const a=actors.values().next().value;
      return {x:Math.max(0,Math.round(a.x-120)),y:Math.max(0,Math.round(a.y-260)),width:440,height:470};})()`);
    await fs.writeFile(path.join(root, 'artifacts', `nova-${scene}-detail.png`), (await window.webContents.capturePage(bounds)).toPNG());
  }
  if (scene === 'chat') {
    window.webContents.send('fixture:memory-cleared', {});
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.companion-history').textContent`), '');
  }
  if (scene === 'play') {
    window.webContents.send('fixture:desktop', { ...desktop, idleMs: 0, moved: true });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(await window.webContents.executeJavaScript(`document.querySelector('.cursor-decoy').hidden`), true);
  }
  assert.deepEqual(errors, []);
  process.stdout.write(`Verified ${scene}: ${JSON.stringify(details)}\n`);
  app.quit();
}).catch((error) => { process.stderr.write(`${error.stack}\n`); app.exit(1); });
