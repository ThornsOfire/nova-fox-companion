'use strict';

const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { probeBridge } = require('./integration-probe.cjs');
const { resolveCodexHome } = require('./codex-home.cjs');
const path = require('node:path');
const {
  hasInstalledHooks,
  mergeHooksConfig,
  removeHooksConfig,
} = require('./hook-config.cjs');

function defaultHooksPath() {
  const codexBase = resolveCodexHome().path;
  return path.join(codexBase, 'hooks.json');
}

async function readConfig(hooksPath = defaultHooksPath()) {
  try {
    const source = await fs.readFile(hooksPath, 'utf8');
    const config = JSON.parse(source);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Unsupported hook configuration.');
    return { exists: true, config, source };
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, config: {} };
    if (error instanceof SyntaxError) {
      throw new Error(`Cannot update ${hooksPath}: the existing JSON is invalid.`);
    }
    throw error;
  }
}

async function writeConfig(hooksPath, config, previous) {
  async function unchanged() {
    let source;
    try { source = await fs.readFile(hooksPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (source !== previous.source) throw new Error('Hook configuration changed during the operation. Please retry.');
  }
  await unchanged();
  const shouldBackup = previous.exists;
  await fs.mkdir(path.dirname(hooksPath), { recursive: true });
  let backupPath = null;

  if (shouldBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${hooksPath}.backup-${stamp}-${randomUUID()}`;
    await fs.copyFile(hooksPath, backupPath);
  }

  const serialized = `${JSON.stringify(config, null, 2)}\n`;
  const temporary = `${hooksPath}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    await unchanged();
    await fs.rename(temporary, hooksPath);
  } finally { await fs.rm(temporary, { force: true }); }
  return backupPath;
}

async function installHooks(scriptPath, hooksPath = defaultHooksPath()) {
  const current = await readConfig(hooksPath);
  const status = await hooksStatus(hooksPath);
  if (status.upstreamDetected || status.upstreamRunning) throw new Error('Codex Avatars integration detected in this home. Disable it before installing Nova hooks.');
  const next = mergeHooksConfig(current.config, scriptPath);
  const backupPath = await writeConfig(hooksPath, next, current);
  return { hooksPath, backupPath, installed: true };
}

async function uninstallHooks(hooksPath = defaultHooksPath()) {
  const current = await readConfig(hooksPath);
  if (!current.exists || !hasInstalledHooks(current.config)) {
    return { hooksPath, backupPath: null, installed: false, changed: false };
  }

  const next = removeHooksConfig(current.config);
  const backupPath = await writeConfig(hooksPath, next, current);
  return { hooksPath, backupPath, installed: false, changed: true };
}

async function hooksStatus(hooksPath = defaultHooksPath()) {
  const current = await readConfig(hooksPath);
  let inline = '';
  try { inline = await fs.readFile(path.join(path.dirname(hooksPath), 'config.toml'), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const upstreamDetected = /CODEX_AVATARS_HOOK_V1|codex-avatars(?:-v1|@|[\\/]|[\x22\x27])/i.test(`${current.source || ''}\n${inline}`);
  const upstreamRunning = await probeBridge();
  return { hooksPath, upstreamRunning, installed: current.exists && hasInstalledHooks(current.config), upstreamDetected,
    detectionScope: 'Selected home hooks.json and config.toml; plugin caches and other homes are not scanned.' };
}

const operations = new Map();
function serialized(operation) {
  return (first, second) => {
    const key = path.resolve(operation === installHooks ? (second || defaultHooksPath()) : (first || defaultHooksPath()));
    const pending = (operations.get(key) || Promise.resolve()).catch(() => {}).then(() => operation(first, second));
    operations.set(key, pending);
    void pending.finally(() => { if (operations.get(key) === pending) operations.delete(key); }).catch(() => {});
    return pending;
  };
}
module.exports = {
  defaultHooksPath,
  hooksStatus,
  installHooks: serialized(installHooks),
  readConfig,
  uninstallHooks: serialized(uninstallHooks),
};
