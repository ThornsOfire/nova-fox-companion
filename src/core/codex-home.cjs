'use strict';

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function resolveCodexHome(selected = null, environment = process.env, home = os.homedir()) {
  const override = typeof selected === 'string' ? selected.trim() : '';
  const inherited = environment.CODEX_HOME?.trim();
  return { path: path.resolve(override || inherited || path.join(home, '.codex')),
    source: override ? 'selected' : inherited ? 'CODEX_HOME' : 'default' };
}

async function validateCodexHome(folder) {
  if (typeof folder !== 'string' || !path.isAbsolute(folder) || /[\x00-\x1f]/.test(folder)) {
    throw new Error('Select an existing Codex data folder.');
  }
  const resolved = await fs.realpath(folder);
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error('Select a folder, not a file.');
  // Recognize an existing home without opening credentials or conversation contents.
  for (const name of ['config.toml', 'sessions', 'session_index.jsonl', 'hooks.json', 'auth.json']) {
    try { await fs.access(path.join(resolved, name)); return resolved; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('This folder does not look like an existing Codex home.');
}

function matchesCodexHome(source, selected) {
  if (source === undefined) return true; // Older Nova events have no home tag.
  if (typeof source !== 'string' || !path.isAbsolute(source)) return false;
  const normalize = (value) => {
    let resolved = path.resolve(value);
    try { resolved = fsSync.realpathSync.native(resolved); } catch { }
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(source) === normalize(selected);
}
module.exports = { resolveCodexHome, validateCodexHome, matchesCodexHome };
