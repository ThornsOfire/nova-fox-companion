'use strict';
// Read-only Codex protocol smoke against disposable homes; never starts a turn or trusts hooks.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const assert = require('node:assert/strict');
const { installHooks, uninstallHooks } = require('../src/core/hook-config-service.cjs');
const executable = process.argv[2];
const label = process.argv[3];
if (!executable || !path.isAbsolute(executable) || !/^[a-z][a-z0-9-]{0,30}$/.test(label || '')) {
  throw new Error('Usage: node scripts/verify-codex-runtime.cjs <absolute codex executable> <label>');
}
const root = path.resolve(__dirname, '..');
function connect(home, workspace) {
  const child = spawn(executable, ['app-server'], { cwd: workspace, env: { ...process.env, CODEX_HOME: home },
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  const pending = new Map(); let nextId = 0;
  child.on('error', failAll); child.on('exit', () => failAll(new Error('Test runtime exited')));
  function failAll(error) { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); } pending.clear(); }
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', line => { let value; try { value = JSON.parse(line); } catch { return; }
    const item = pending.get(value.id); if (!item) return;
    pending.delete(value.id); clearTimeout(item.timer);
    if (value.error) item.reject(new Error(JSON.stringify(value.error))); else item.resolve(value.result);
  });
  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
      pending.set(id, {resolve, reject, timer});
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  return { request, notify: (method) => child.stdin.write(JSON.stringify({method}) + '\n'),
    close: async () => { lines.close(); child.stdin.end(); child.kill(); await new Promise(resolve => {
      if (child.exitCode !== null) return resolve(); child.once('exit', resolve); }); } };
}
(async () => {
  const base = await fs.mkdtemp(path.join(root, 'work', `runtime-${label}-`));
  const home = path.join(base, 'codex-home'); const workspace = path.join(base, 'workspace');
  await fs.mkdir(home); await fs.mkdir(workspace);
  await fs.writeFile(path.join(home, 'config.toml'), '# Disposable Nova compatibility test\n');
  const hooksPath = path.join(home, 'hooks.json');
  await fs.writeFile(hooksPath, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo unrelated-test-hook' }] }] } }));
  await installHooks(path.join(root, 'scripts', 'codex-hook.ps1'), hooksPath);
  let count;
  for (let cycle = 0; cycle < 2; cycle++) {
    const client = connect(home, workspace);
    try {
      await client.request('initialize', { clientInfo: { name: 'nova_compatibility_check', version: '0.1.0' }, capabilities: { experimentalApi: true } });
      client.notify('initialized');
      const result = await client.request('hooks/list', { cwds: [workspace] });
      const entries = result.data || [];
      assert.equal(entries.flatMap(e => e.errors || []).length, 0);
      const hooks = entries.flatMap(e => e.hooks || []);
      const nova = hooks.filter(h => h.command?.includes('NOVA_FOX_COMPANION_HOOK_V1'));
      assert.equal(nova.length, 7);
      assert.ok(hooks.some(h => h.command === 'echo unrelated-test-hook'));
      assert.ok(nova.every(h => h.trustStatus !== 'trusted'));
      count = nova.length;
    } finally { await client.close(); }
  }
  await uninstallHooks(hooksPath);
  assert.equal(JSON.parse(await fs.readFile(hooksPath, 'utf8')).hooks.Stop[0].hooks[0].command, 'echo unrelated-test-hook');
  const report = { label, version: execFileSync(executable, ['--version'], {encoding:'utf8',windowsHide:true}).trim(),
    hookCount: count, restartCycles: 2, preservedUnrelatedHook: true, hookTrustUnchanged: true,
    modelCalls: 0, desktopCloseReopenTested: false };
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', `compatibility-${label}.json`), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report) + '\n');
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
