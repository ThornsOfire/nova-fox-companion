const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sync = require('node:fs');
sync.mkdirSync(path.join(root, 'work'), { recursive: true });
const work = sync.mkdtempSync(path.join(root, 'work', 'compatibility-preview-'));
app.getVersion = () => require('../package.json').version;
app.getAppPath = () => root;
const first = path.join(work, 'home-a');
const second = path.join(work, 'home-b');
process.env.CODEX_HOME = first;
process.argv.push(`--profile=${path.join(work, 'nova-data')}`, '--disable-gpu');
app.disableHardwareAcceleration();
let selected = second;
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
const errors = [];
app.on('web-contents-created', (_, contents) => contents.on('console-message', (_, detail, message) => {
  if (typeof detail === 'object' ? detail.level === 'error' : detail === 3) errors.push(detail.message || message);
}));
require('node:fs').mkdirSync(first, { recursive: true }); require('node:fs').mkdirSync(second, { recursive: true });
require('node:fs').writeFileSync(path.join(first, 'config.toml'), '# isolated home A');
require('node:fs').writeFileSync(path.join(second, 'config.toml'), '# isolated home B');
require('node:fs').mkdirSync(path.join(work, 'nova-data'), { recursive: true });
require('node:fs').writeFileSync(path.join(work, 'nova-data', 'settings.json'), JSON.stringify({ onboardingCompleted: true, companionVoiceMuted: true, avoidFullscreen: false }));
require('../src/main.cjs');

(async () => {
  let window;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    window = BrowserWindow.getAllWindows().find(w => /index\.html$/.test(w.webContents.getURL()));
    if (window && !window.webContents.isLoading()) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(window, 'settings window loads');
  const run = code => window.webContents.executeJavaScript(code);
  const overlay = BrowserWindow.getAllWindows().find(w => /overlay\.html$/.test(w.webContents.getURL()));
  assert.ok(overlay);
  const requestedBounds = (await overlay.webContents.executeJavaScript('window.novaFoxCompanion.getBootstrap()')).zone.windowBounds;
  assert.deepEqual(overlay.getBounds(), requestedBounds, 'desktop-spanning bounds must match across mixed DPI monitors');
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await overlay.webContents.executeJavaScript(`typeof actors !== 'undefined' && actors.size > 0`).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  const roaming = await overlay.webContents.executeJavaScript(`(() => {const zones=viewportZones();
    return {zones:zones.length,path:zones.length>1?topology.findZonePath(zones,0,1):[0]};})()`);
  if(roaming.zones>1) assert.ok(roaming.path && roaming.path.length>1,'adjacent real monitors must be reachable across taskbars');

  await overlay.webContents.executeJavaScript(`(() => {const a=actors.values().next().value;
    a.x=250;a.y=320;a.targetX=250;a.targetY=320;a.awakeUntil=0;
    a.element.style.transform='translate3d(250px,320px,0)';})()`);
  const spiritPoint = await overlay.webContents.executeJavaScript(`(() => {const r=document.querySelector('.companion-spirit').getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
  overlay.webContents.sendInputEvent({type:'mouseDown',...spiritPoint,button:'left',clickCount:1});
  overlay.webContents.sendInputEvent({type:'mouseUp',...spiritPoint,button:'left',clickCount:1});
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(await overlay.webContents.executeJavaScript(`document.querySelector('.companion-chat').hidden`), false);
  assert.equal(await overlay.webContents.executeJavaScript(`document.activeElement === document.querySelector('.companion-chat-line input')`), true);
  await overlay.webContents.executeJavaScript('closeChat()');
  await run("window.novaFoxCompanion.updateSettings({companionVoiceProvider:'cloud',companionVoiceMuted:false})");
  const speechStatus = await run("window.novaFoxCompanion.speakQuip({id:'preview-no-key',quip:'Tiny paws, big plans.'})");
  assert.match(speechStatus.error, /API key/);
  await run('window.novaFoxCompanion.updateSettings({companionVoiceMuted:true})');
  await overlay.webContents.executeJavaScript('window.novaFoxCompanion.hideCompanion()');
  assert.equal(overlay.isVisible(), false);
  await run('window.novaFoxCompanion.updateSettings({overlayEnabled:true})');
  assert.equal(overlay.isVisible(), true);
  const wav = require('../src/core/companion-speech.cjs').wav(Buffer.alloc(4800));
  await overlay.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const a=new Audio('data:audio/wav;base64,${wav.toString('base64')}');a.onended=()=>resolve(true);a.onerror=reject;a.play().catch(reject);})`);


  let status = await run('window.novaFoxCompanion.integrationStatus()');
  assert.equal(status.home, first); assert.equal(status.source, 'CODEX_HOME');
  status = await run('window.novaFoxCompanion.selectCodexHome()');
  assert.equal(status.home, second); assert.equal(status.source, 'selected');
  await run('window.novaFoxCompanion.installHooks()');
  status = await run('window.novaFoxCompanion.selectCodexHome(true)');
  assert.match(status.error, /Remove Nova hooks/);
  await run('window.novaFoxCompanion.uninstallHooks()');
  status = await run('window.novaFoxCompanion.selectCodexHome(true)');
  assert.equal(status.home, first); assert.equal(status.source, 'CODEX_HOME');
  selected = work; // not a Codex home; picker must not create one
  status = await run('window.novaFoxCompanion.selectCodexHome()');
  assert.match(status.error, /does not look/);
  assert.equal((await run('window.novaFoxCompanion.integrationStatus()')).home, first);
  await fs.writeFile(path.join(first, 'hooks.json'), JSON.stringify({hooks:{Stop:[{hooks:[{command:'echo CODEX_AVATARS_HOOK_V1'}]}]}}));
  status = await run('window.novaFoxCompanion.integrationStatus()');
  assert.equal(status.hooks.upstreamDetected, true);
  await assert.rejects(run('window.novaFoxCompanion.installHooks()'));
  await fs.rename(first, `${first}-offline`);
  status = await run('window.novaFoxCompanion.integrationStatus()');
  assert.equal(status.available, false);
  await fs.rename(`${first}-offline`, first);
  status = await run('window.novaFoxCompanion.integrationStatus()');
  assert.equal(status.available, true);
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.deepEqual(errors, []);
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', 'nova-compatibility-settings.png'), (await window.webContents.capturePage()).toPNG());
  process.stdout.write('Verified bounds, real chat focus, speech missing-key gate, in-memory audio playback, hide/restore, picker, selected-home hooks, conflicts and unavailable-home recovery.\n');
  app.quit();
})().catch(error => { process.stderr.write(`${error.stack}\n${JSON.stringify(errors)}\n`); app.exit(1); });
