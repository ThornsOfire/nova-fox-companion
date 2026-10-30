'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hooksStatus,
  installHooks,
  uninstallHooks,
} = require('../src/core/hook-config-service.cjs');

test('install and uninstall round-trip a temporary hook configuration', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-fox-companion-hooks-'));
  const hooksPath = path.join(directory, 'hooks.json');
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  await fs.writeFile(hooksPath, JSON.stringify({
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'keep-this' }] }],
    },
  }), 'utf8');

  const installed = await installHooks('C:\\Nova Fox Companion\\codex-hook.ps1', hooksPath);
  assert.equal(installed.installed, true);
  assert.ok(installed.backupPath);
  assert.equal((await hooksStatus(hooksPath)).installed, true);

  const uninstalled = await uninstallHooks(hooksPath);
  assert.equal(uninstalled.changed, true);
  assert.equal((await hooksStatus(hooksPath)).installed, false);

  const finalConfig = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
  assert.equal(finalConfig.hooks.Stop[0].hooks[0].command, 'keep-this');
});

test('invalid existing JSON is never overwritten', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-fox-companion-invalid-'));
  const hooksPath = path.join(directory, 'hooks.json');
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(hooksPath, '{ invalid', 'utf8');

  await assert.rejects(() => installHooks('C:\\hook.ps1', hooksPath), /existing JSON is invalid/);
  assert.equal(await fs.readFile(hooksPath, 'utf8'), '{ invalid');
});


test('upstream detection blocks install without changing the selected home', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-conflict-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'hooks.json');
  const source = JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: 'powershell -Marker CODEX_AVATARS_HOOK_V1' }] }] } });
  await fs.writeFile(file, source);
  assert.equal((await hooksStatus(file)).upstreamDetected, true);
  await assert.rejects(installHooks('C:/Nova/hook.ps1', file), /Codex Avatars/);
  assert.equal(await fs.readFile(file, 'utf8'), source);
  assert.equal((await uninstallHooks(file)).changed, false);
});

test('unsupported hook shapes and unrelated opaque groups are preserved', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-hooks-shapes-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'hooks.json');
  for (const source of ['null', '[]', '{"hooks":[]}', '{"hooks":{"Stop":{}}}']) {
    await fs.writeFile(file, source);
    await assert.rejects(installHooks('C:/Nova/hook.ps1', file));
    assert.equal(await fs.readFile(file, 'utf8'), source);
  }
  const opaque = { hooks: { Stop: [{ futureField: true }, { hooks: [], matcher: 'future' }] } };
  await fs.writeFile(file, JSON.stringify(opaque));
  await installHooks('C:/Nova/hook.ps1', file);
  await uninstallHooks(file);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).hooks, opaque.hooks);
});
