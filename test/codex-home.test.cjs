const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { resolveCodexHome, validateCodexHome, matchesCodexHome } = require('../src/core/codex-home.cjs');
const { SettingsStore } = require('../src/core/settings-store.cjs');

test('explicit home wins over CODEX_HOME, which wins over the standard default', () => {
  const home = path.resolve('work/user');
  const selected = path.resolve('work/selected');
  const inherited = path.resolve('work/inherited');
  assert.deepEqual(resolveCodexHome(selected, { CODEX_HOME: inherited }, home), { path: selected, source: 'selected' });
  assert.deepEqual(resolveCodexHome(null, { CODEX_HOME: inherited }, home), { path: inherited, source: 'CODEX_HOME' });
  assert.deepEqual(resolveCodexHome(null, {}, home), { path: path.join(home, '.codex'), source: 'default' });
});

test('picker recognizes an existing home without creating or modifying it', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-home-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(validateCodexHome(root), /does not look/);
  await assert.rejects(validateCodexHome(path.join(root, 'missing')));
  await assert.rejects(validateCodexHome('relative'));
  await fs.writeFile(path.join(root, 'config.toml'), '# existing home');
  assert.equal(await validateCodexHome(root), await fs.realpath(root));
  assert.equal(await fs.readFile(path.join(root, 'config.toml'), 'utf8'), '# existing home');
  assert.deepEqual(await fs.readdir(root), ['config.toml']);
});

test('selected home persists in Nova settings and can return to automatic selection', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-home-settings-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'nova-data/settings.json');
  const store = new SettingsStore(file);
  await store.load();
  await store.update({ codexHome: root });
  assert.equal((await new SettingsStore(file).load()).codexHome, root);
  await store.update({ codexHome: null });
  assert.equal((await new SettingsStore(file).load()).codexHome, null);
});

test('tagged events from a different home are ignored, legacy events remain compatible', () => {
  const selected = path.resolve('work/selected');
  assert.equal(matchesCodexHome(selected, selected), true);
  assert.equal(matchesCodexHome(path.resolve('work/other'), selected), false);
  assert.equal(matchesCodexHome({}, selected), false);
  assert.equal(matchesCodexHome(undefined, selected), true);
});


test('failed settings persistence cannot silently change the active home', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-home-failure-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const blocked = path.join(root, 'settings.json');
  await fs.mkdir(blocked);
  const store = new SettingsStore(blocked);
  await assert.rejects(store.update({ codexHome: root }));
  assert.equal(store.snapshot().codexHome, null);
});
