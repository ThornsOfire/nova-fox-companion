'use strict';

const { HOOK_MARKER } = require('./constants.cjs');

const EVENTS = [
  ['SessionStart', 'startup|resume|clear|compact'],
  ['SessionEnd', null],
  ['UserPromptSubmit', null],
  ['Stop', null],
  ['PermissionRequest', null],
  ['SubagentStart', null],
  ['SubagentStop', null],
];

function quotePowerShell(value) {
  return `"${String(value).replace(/"/g, '`"')}"`;
}

function hookCommand(scriptPath) {
  return [
    'powershell.exe',
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy Bypass',
    `-File ${quotePowerShell(scriptPath)}`,
    `-Marker ${quotePowerShell(HOOK_MARKER)}`,
  ].join(' ');
}

function isOurHandler(handler) {
  if (!handler || typeof handler !== 'object') return false;
  return [handler.command, handler.commandWindows, handler.command_windows]
    .some((value) => typeof value === 'string' && new RegExp(`(?:^|[^A-Za-z0-9_])${HOOK_MARKER}(?:$|[^A-Za-z0-9_])`).test(value));
}

function withoutOurHandlers(groups) {
  if (!Array.isArray(groups)) throw new Error('Unsupported hook groups; leaving the configuration unchanged.');

  return groups.flatMap((group) => {
    if (!group || typeof group !== 'object' || !Array.isArray(group.hooks)) return [group];
    const handlers = group.hooks.filter((hook) => !isOurHandler(hook));
    if (handlers.length === group.hooks.length) return [group];
    return handlers.length ? [{ ...group, hooks: handlers }] : [];
  });
}

function mergeHooksConfig(existing, scriptPath) {
  const next = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? structuredClone(existing)
    : {};
  next.description ||= 'User lifecycle hooks for Codex.';
  if (next.hooks !== undefined && (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks))) {
    throw new Error('Unsupported hooks configuration; leaving it unchanged.');
  }
  next.hooks = next.hooks && typeof next.hooks === 'object' && !Array.isArray(next.hooks)
    ? next.hooks
    : {};

  const command = hookCommand(scriptPath);
  for (const [eventName, matcher] of EVENTS) {
    const groups = withoutOurHandlers(next.hooks[eventName] === undefined ? [] : next.hooks[eventName]);
    const group = {
      ...(matcher ? { matcher } : {}),
      hooks: [{
        type: 'command',
        command,
        commandWindows: command,
        ...(eventName === 'SessionEnd' ? {} : { timeout: 3 }),
      }],
    };
    next.hooks[eventName] = [...groups, group];
  }

  return next;
}

function removeHooksConfig(existing) {
  const next = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? structuredClone(existing)
    : {};
  if (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks)) return next;

  for (const eventName of Object.keys(next.hooks)) {
    const groups = withoutOurHandlers(next.hooks[eventName] === undefined ? [] : next.hooks[eventName]);
    if (groups.length) next.hooks[eventName] = groups;
    else delete next.hooks[eventName];
  }

  return next;
}

function hasInstalledHooks(config) {
  if (!config?.hooks || typeof config.hooks !== 'object') return false;
  return Object.values(config.hooks).some((groups) =>
    Array.isArray(groups) && groups.some((group) =>
      Array.isArray(group?.hooks) && group.hooks.some(isOurHandler)));
}

module.exports = {
  EVENTS,
  hasInstalledHooks,
  hookCommand,
  isOurHandler,
  mergeHooksConfig,
  removeHooksConfig,
};
