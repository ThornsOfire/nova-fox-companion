'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  screen,
  shell,
  Tray,
  safeStorage,
} = require('electron');
const { AgentStore } = require('./core/agent-store.cjs');
const { ScaledTrayMenu } = require('./core/tray-menu.cjs');
const { fitSurface } = require('./renderer/overlay-performance.js');
let scaledTrayMenu = null;
const { DesktopSensor } = require('./core/desktop-sensor.cjs');
const { allowedWindow, captureWindow } = require('./core/window-vision.cjs');
let lastForegroundWindowId = null;
const { readPngDimensions } = require('./core/frame-atlas.cjs');
const { blockedDisplays, safeZones } = require('./renderer/desktop-play.js');
let desktopSensor = null;
let desktopTimer = null;
let desktopSample = { available: false, windows: [], timestamp: 0 };
let fullscreenSuppressed = false;
let overlayControlHitTest = false;
let overlayChatOpen = false;
let nativeDisplayScales = [];
let settingsWindowScale = 1;
let lastCursorPoint = null;
let cursorIdleSince = Date.now();
const knownChatSessions = new Set();
const { SCHEME: RESTORE_SCHEME, isRestoreLink, registerFreshRestoreLink } = require('./core/restore-link.cjs');
const { CompanionSpeech } = require('./core/companion-speech.cjs');
let companionSpeech = null;
const { CompanionBrain, CompanionKeyStore, CompanionMemory } = require('./core/companion-brain.cjs');
const { introduction } = require('./core/companion-profile.cjs');
let companionBrain = null;
let companionKeys = null;
const { reconcileAgentActivityRecords } = require('./core/agent-activity-reconciler.cjs');
const {
  AgentMetadataResolver,
  ThreadTitleMonitor,
  readRecentAgentActivityRecords,
} = require('./core/agent-metadata.cjs');
const { discoverAvatars, readWebpDimensions } = require('./core/avatar-library.cjs');
const { reconcileAvatarSelection } = require('./core/avatar-selection.cjs');
const { buildAvatarPrompt, codexNewThreadUrl } = require('./core/codex-launch.cjs');
const { normalizeHookEvent } = require('./core/event-normalizer.cjs');
const { buildFeedbackUrl, buildPetReportUrl } = require('./core/feedback-links.cjs');
const { createEventServer } = require('./core/pipe-server.cjs');
const {
  marketplacePath: resolvePluginMarketplacePath,
  pluginDeepLink,
} = require('./core/plugin-integration.cjs');
const {
  bootstrapWindowBounds,
  localRectToVirtual,
  resolveRoamingZone,
  serializeDisplay,
} = require('./core/roaming-zone.cjs');
const { exportPetPackage, importPetPackage, installPetBuffers } = require('./core/pet-packages.cjs');
const {
  CATALOG_GUIDE_URL,
  CATALOG_SITE_URL,
  MarketplaceClient,
  safeCatalogSlug,
  sha256,
} = require('./core/marketplace-client.cjs');
const {
  GITHUB_DEVICE_AUTHORIZATION_URL,
  GitHubCli,
  normalizeGitHubDeviceCode,
} = require('./core/github-cli.cjs');
const {
  CANONICAL_CATEGORY_PREFIXES: MARKETPLACE_CANONICAL_CATEGORY_PREFIXES,
  CATEGORIES: MARKETPLACE_CATEGORIES,
  GitHubMarketplacePublisher,
  SOURCE_TYPES: MARKETPLACE_SOURCE_TYPES,
  SOURCE_TYPES_REQUIRING_NOTES: MARKETPLACE_SOURCE_TYPES_REQUIRING_NOTES,
  analyzeCatalogDuplicates,
  prepareLocalSubmission,
} = require('./core/marketplace-submission.cjs');
const {
  getLaunchAtLogin,
  normalizeLaunchAtLogin,
  setLaunchAtLogin,
} = require('./core/login-item.cjs');
const { mergeSettings, SettingsStore } = require('./core/settings-store.cjs');
const { resolveCodexHome, validateCodexHome, matchesCodexHome } = require('./core/codex-home.cjs');
const { checkForUpdate } = require('./core/update-check.cjs');
const {
  hooksStatus,
  installHooks,
  uninstallHooks,
} = require('./core/hook-config-service.cjs');

// Mixed-DPI desktop-spanning overlays otherwise receive clamped, offset Win32 bounds.
// This affects Nova only; it does not change Windows display scaling.
if (process.platform === 'win32') app.commandLine.appendSwitch('force-device-scale-factor', '1');

protocol.registerSchemesAsPrivileged([{
  scheme: 'nova-fox-companion',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
  },
}]);

let store = new AgentStore();
const captureArgument = findArgument('--capture=');
const settingsCaptureArgument = findArgument('--capture-settings=');
const settingsScrollArgument = findArgument('--settings-scroll=');
const onboardingCapture = process.argv.includes('--capture-onboarding');
const zonePickerCaptureArgument = findArgument('--capture-zone-picker=');
const profileArgument = findArgument('--profile=');
const capturePath = captureArgument ? path.resolve(process.cwd(), captureArgument) : null;
const settingsCapturePath = settingsCaptureArgument
  ? path.resolve(process.cwd(), settingsCaptureArgument)
  : null;
const zonePickerCapturePath = zonePickerCaptureArgument
  ? path.resolve(process.cwd(), zonePickerCaptureArgument)
  : null;
if (profileArgument) app.setPath('userData', path.resolve(process.cwd(), profileArgument));
const eventServer = createEventServer(handlePayload, profileArgument
  ? { pipeName: `nova-fox-companion-preview-${process.pid}` }
  : undefined);
const backgroundLaunch = process.argv.includes('--background');
const commandLineAction = process.argv.includes('--install-hooks')
  ? 'install'
  : process.argv.includes('--uninstall-hooks')
    ? 'uninstall'
    : null;

let settingsStore = null;
let settings = null;
let overlayWindow = null;
let settingsWindow = null;
let zonePickerWindow = null;
let zonePickerResolve = null;
let zonePickerBounds = null;
let tray = null;
let cleanupTimer = null;
let avatarRefreshTimer = null;
let agentActivityTimer = null;
let avatarRecords = [];
let avatarErrors = [];
let assetPaths = new Map();
let overlayHitTest = false;
let isQuitting = false;
let metadataResolver = null;
let homeGeneration = 0;
let bridgeError = null;
let bridgeRetryTimer = null;
let lastHookAt = null;
let threadTitleMonitor = null;
const pendingMetadata = new Set();
const recentAgentActivityCache = new Map();
let agentActivityRefreshPromise = null;
let demoSessionId = null;
const demoTimers = new Set();
let updateCheckStarted = false;
let marketplaceClient = null;
const pendingMarketplaceInstalls = new Map();
let githubCli = null;
let githubPublisher = null;
let pendingGithubConnection = null;
let pendingGithubConnectionAbortController = null;
let pendingMarketplaceSubmission = null;

function findArgument(prefix) {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

async function promptForUpdate() {
  // Fork releases need their own verified updater; never offer an upstream installer.
  return; // Release updates stay opt-in until the fork has a verified release pipeline.
  if (!app.isPackaged || updateCheckStarted) return;
  updateCheckStarted = true;
  let update = null;
  try {
    update = await checkForUpdate({
      currentVersion: app.getVersion(),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return;
  }
  if (!update) return;
  const french = settings?.language === 'fr';
  const result = await dialog.showMessageBox(settingsWindow, {
    type: 'info',
    title: 'Nova Fox Companion',
    message: french
      ? `Une mise à jour de Nova Fox Companion (${update.version}) est disponible.`
      : `A Nova Fox Companion update (${update.version}) is available.`,
    detail: french
      ? 'Téléchargez l’installateur, puis exécutez-le pour mettre à jour sans perdre vos réglages ni vos Pets.'
      : 'Download and run the installer to update without losing your settings or Pets.',
    buttons: french ? ['Télécharger la mise à jour', 'Plus tard'] : ['Download update', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (result.response === 0) await shell.openExternal(update.downloadUrl);
}

function hookScriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'hooks', 'codex-hook.ps1')
    : path.join(__dirname, '..', 'scripts', 'codex-hook.ps1');
}

function codexHomePath() {
  return resolveCodexHome(settings?.codexHome).path;
}

function pluginMarketplacePath() {
  return resolvePluginMarketplacePath({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: path.join(__dirname, '..'),
  });
}

async function openPluginInCodex() {
  const marketplace = pluginMarketplacePath();
  try {
    await fs.access(marketplace);
    const url = pluginDeepLink(marketplace);
    await shell.openExternal(url);
    return { opened: true, url };
  } catch (error) {
    return { opened: false, message: error.message };
  }
}

async function openFeedback() {
  const french = settings?.language === 'fr';
  const result = await dialog.showMessageBox(settingsWindow, {
    type: 'question',
    title: 'Nova Fox Companion',
    message: french ? 'Que souhaitez-vous partager ?' : 'What would you like to share?',
    detail: french
      ? 'GitHub s’ouvrira avec un brouillon guidé et la version de Nova Fox Companion déjà renseignée.'
      : 'GitHub will open with a guided draft and your Nova Fox Companion version already filled in.',
    buttons: french
      ? ['Signaler un bug', 'Proposer une amélioration', 'Annuler']
      : ['Report a bug', 'Suggest an improvement', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  if (result.response === 2) return { opened: false, cancelled: true };
  const kind = result.response === 0 ? 'bug' : 'suggestion';
  const url = buildFeedbackUrl({ kind, version: app.getVersion(), language: settings?.language });
  await shell.openExternal(url);
  return { opened: true, cancelled: false, kind };
}

async function openMarketplacePetReport(rawSlug, payload) {
  if (!marketplaceClient) throw new Error('The marketplace is not ready yet.');
  const slug = safeCatalogSlug(rawSlug);
  const record = await marketplaceClient.record(slug, { signal: AbortSignal.timeout(12_000) });
  const url = buildPetReportUrl({
    pet: record,
    reason: payload?.reason,
    details: payload?.details,
    version: app.getVersion(),
    language: settings?.language,
  });
  await shell.openExternal(url);
  return { opened: true, slug };
}

function publicAvatar(record) {
  return {
    id: record.id,
    displayName: record.displayName,
    description: record.description,
    spriteVersionNumber: record.spriteVersionNumber,
    columns: record.columns,
    rows: record.rows,
    frameAtlas: record.frameAtlas || null,
    source: record.source,
    // `nova-fox-companion:` works in development but packaged Windows renderers can
    // reject a local WebP response from that custom protocol. Every record has
    // already passed the local Pet path and dimension checks, so a file URL is
    // the reliable renderer-only delivery path for this validated asset.
    assetUrl: pathToFileURL(record.spritesheetPath).toString(),
  };
}

function publicAvatars() {
  return avatarRecords.map(publicAvatar);
}

function publicMarketplaceCatalog(catalog) {
  const installedIds = new Set(avatarRecords.map((avatar) => avatar.id));
  return {
    provider: catalog.provider,
    repositoryUrl: catalog.repositoryUrl,
    siteUrl: catalog.siteUrl,
    guideUrl: catalog.guideUrl,
    fetchedAt: catalog.fetchedAt,
    source: catalog.source,
    stale: Boolean(catalog.stale),
    duplicateCount: catalog.duplicateCount,
    sources: catalog.sources,
    pets: catalog.pets.map((pet) => ({
      slug: pet.slug,
      name: pet.name,
      localizedNames: pet.localizedNames,
      author: pet.author,
      authorHandle: pet.authorHandle,
      authorUrl: pet.authorUrl,
      primaryCategory: pet.primaryCategory,
      collections: pet.collections,
      license: pet.license,
      description: pet.description,
      spriteVersionNumber: 2,
      spritesheetBytes: pet.spritesheetBytes,
      catalogSource: pet.catalogSource,
      repository: pet.repository,
      detailsUrl: pet.detailsUrl,
      installed: installedIds.has(pet.slug),
    })),
  };
}

async function loadMarketplace(force = false) {
  if (!marketplaceClient) throw new Error('The marketplace is not ready yet.');
  const catalog = await marketplaceClient.load({
    force,
    signal: AbortSignal.timeout(12_000),
  });
  return publicMarketplaceCatalog(catalog);
}

async function installMarketplacePet(rawSlug) {
  const slug = safeCatalogSlug(rawSlug);
  if (pendingMarketplaceInstalls.has(slug)) return pendingMarketplaceInstalls.get(slug);
  const operation = (async () => {
    const record = await marketplaceClient.record(slug, { signal: AbortSignal.timeout(12_000) });
    const existing = avatarRecords.find((avatar) => avatar.id === slug);
    if (existing) {
      const existingHash = sha256(await fs.readFile(existing.spritesheetPath));
      if (existingHash === record.spritesheetSha256) {
        return {
          alreadyInstalled: true,
          imported: { id: existing.id, displayName: existing.displayName, directory: existing.directory },
        };
      }
      throw new Error(`A different local Pet already uses the marketplace id ${slug}.`);
    }

    const downloaded = await marketplaceClient.fetchPetFiles(slug, { signal: AbortSignal.timeout(60_000) });
    const imported = await installPetBuffers(
      downloaded.petJson,
      downloaded.spritesheet,
      path.join(codexHomePath(), 'pets'),
      { requestedId: slug, collision: 'reject' },
    );
    await refreshAvatarLibrary();
    return { alreadyInstalled: false, imported };
  })();
  pendingMarketplaceInstalls.set(slug, operation);
  try {
    return await operation;
  } finally {
    pendingMarketplaceInstalls.delete(slug);
  }
}

function sendMarketplaceSubmissionProgress(stage, extra = {}) {
  if (!settingsWindow || settingsWindow.isDestroyed() || settingsWindow.webContents.isDestroyed()) return;
  settingsWindow.webContents.send('nova:marketplace-submission-progress', { stage, ...extra });
}

async function marketplaceSubmissionStatus() {
  if (!githubCli) throw new Error('GitHub submission is not ready yet.');
  const github = await githubCli.status();
  return {
    github,
    canonicalCategoryPrefixes: MARKETPLACE_CANONICAL_CATEGORY_PREFIXES,
    categories: MARKETPLACE_CATEGORIES,
    sourceTypes: MARKETPLACE_SOURCE_TYPES,
    sourceTypesRequiringNotes: MARKETPLACE_SOURCE_TYPES_REQUIRING_NOTES,
  };
}

async function connectMarketplaceGithub() {
  if (!githubCli) throw new Error('GitHub submission is not ready yet.');
  if (pendingGithubConnection) return pendingGithubConnection;
  const abortController = new AbortController();
  pendingGithubConnectionAbortController = abortController;
  pendingGithubConnection = githubCli.connect({
    signal: abortController.signal,
    onProgress: (stage) => sendMarketplaceSubmissionProgress(stage),
    onDeviceCode: (code) => {
      clipboard.writeText(code);
      sendMarketplaceSubmissionProgress('github-device-code-copied', { code });
      void shell.openExternal(GITHUB_DEVICE_AUTHORIZATION_URL).catch(() => {
        sendMarketplaceSubmissionProgress('github-browser-open-failed', { code });
      });
    },
  }).then((github) => {
    sendMarketplaceSubmissionProgress('github-connected', { login: github.login });
    return {
      github,
      canonicalCategoryPrefixes: MARKETPLACE_CANONICAL_CATEGORY_PREFIXES,
      categories: MARKETPLACE_CATEGORIES,
      sourceTypes: MARKETPLACE_SOURCE_TYPES,
      sourceTypesRequiringNotes: MARKETPLACE_SOURCE_TYPES_REQUIRING_NOTES,
    };
  }).finally(() => {
    pendingGithubConnection = null;
    if (pendingGithubConnectionAbortController === abortController) {
      pendingGithubConnectionAbortController = null;
    }
  });
  return pendingGithubConnection;
}

function cancelMarketplaceGithubConnection() {
  const pending = Boolean(pendingGithubConnectionAbortController);
  pendingGithubConnectionAbortController?.abort();
  return { cancelled: pending };
}

async function submitMarketplacePetDirectly(payload) {
  if (pendingMarketplaceSubmission) throw new Error('A marketplace submission is already in progress.');
  const operation = (async () => {
    const avatarId = typeof payload?.avatarId === 'string' ? payload.avatarId : '';
    const record = avatarRecords.find((avatar) => avatar.id === avatarId);
    if (!record) throw new Error('The selected local Pet is no longer available.');
    const github = await githubCli.status();
    if (!github.connected) {
      const error = new Error('Connect a GitHub account before submitting this Pet.');
      error.code = 'GITHUB_NOT_CONNECTED';
      throw error;
    }

    sendMarketplaceSubmissionProgress('validating-local-pet');
    const prepared = await prepareLocalSubmission(record, payload?.form, { githubLogin: github.login });
    sendMarketplaceSubmissionProgress('checking-marketplace-duplicates');
    const duplicateCatalog = await marketplaceClient.duplicateIndex({
      force: true,
      requireFresh: true,
      signal: AbortSignal.timeout(20_000),
    });
    const duplicateReview = analyzeCatalogDuplicates(prepared, duplicateCatalog);
    const french = settings?.language === 'fr';
    const warningLines = duplicateReview.warnings.length > 0
      ? `\n\n${french ? 'Points à examiner' : 'Review notes'}:\n${duplicateReview.warnings.map((warning) => `• ${warning}`).join('\n')}`
      : '';
    const confirmation = await dialog.showMessageBox(settingsWindow, {
      type: 'warning',
      title: french ? 'Publier ce Pet sur GitHub ?' : 'Publish this Pet on GitHub?',
      message: french
        ? `Créer une pull request publique pour ${prepared.name} ?`
        : `Create a public pull request for ${prepared.name}?`,
      detail: french
        ? `Compte GitHub : @${github.login}\nDépôt : Kajdrak2/awesome-codex-pet\nFichiers publics : submission.json, pet.json et spritesheet.webp\n\nAucun crédit Codex ne sera utilisé. Cette action crée ou met à jour la branche et la pull request publiques de ce Pet.${warningLines}`
        : `GitHub account: @${github.login}\nRepository: Kajdrak2/awesome-codex-pet\nPublic files: submission.json, pet.json, and spritesheet.webp\n\nNo Codex credits will be used. This action creates or updates this Pet's public branch and pull request.${warningLines}`,
      buttons: french ? ['Publier la soumission', 'Annuler'] : ['Publish submission', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (confirmation.response !== 0) {
      sendMarketplaceSubmissionProgress('submission-cancelled');
      return { cancelled: true };
    }

    const published = await githubPublisher.publish(prepared, {
      login: github.login,
      warnings: duplicateReview.warnings,
      onProgress: (stage) => sendMarketplaceSubmissionProgress(stage),
    });
    sendMarketplaceSubmissionProgress('submission-complete', { url: published.url });
    let opened = true;
    try {
      await shell.openExternal(published.url);
    } catch {
      opened = false;
    }
    return { cancelled: false, opened, ...published };
  })();
  pendingMarketplaceSubmission = operation;
  try {
    return await operation;
  } finally {
    pendingMarketplaceSubmission = null;
  }
}

function currentDisplays() {
  const primaryId = String(screen.getPrimaryDisplay().id);
  return screen.getAllDisplays().map((display, index) => serializeDisplay({
    ...display,
    scaleFactor: nativeDisplayScales.find(d => sameBounds(d, display.bounds))?.scaleFactor || display.scaleFactor,
    primary: String(display.id) === primaryId,
  }, index));
}

function currentZone() {
  return resolveRoamingZone(settings?.zone, currentDisplays());
}

function desktopPayload() {
  const now = Date.now();
  const cursor = screen.getCursorScreenPoint();
  const moved = !lastCursorPoint || cursor.x !== lastCursorPoint.x || cursor.y !== lastCursorPoint.y;
  if (moved) cursorIdleSince = now;
  lastCursorPoint = cursor;
  const bounds = currentZone().windowBounds;
  const local = (rect) => ({ ...rect, x: rect.x - bounds.x, y: rect.y - bounds.y });
  const available = desktopSample.available && now - desktopSample.timestamp < 2200;
  const displays = currentDisplays();
  const blocked = settings?.avoidFullscreen ? blockedDisplays(desktopSample.windows, displays) : [];
  const fallback = !settings?.avoidFullscreen || available || Boolean(capturePath || settingsCapturePath);
  const roaming = currentZone();
  const zones = roaming.zones.map((rect, index) => ({ ...rect,
    x: rect.x + roaming.windowBounds.x, y: rect.y + roaming.windowBounds.y,
    monitorBounds: roaming.mode === 'custom' ? null : displays.find(d => String(d.id) === roaming.displayIds[index])?.bounds }));
  const safe = fallback ? safeZones(zones, blocked) : [];
  return { available, timestamp: now, cursor: { x: cursor.x - bounds.x, y: cursor.y - bounds.y },
    moved, idleMs: now - cursorIdleSince, windows: available ? desktopSample.windows.map(local) : [],
    safeZones: safe.map(rect => {
      const original = zones.find(z => sameBounds(z, rect));
      return { ...local(rect), monitorBounds: original?.monitorBounds ? local(original.monitorBounds) : null, monitorScale: original?.monitorBounds ? displays.find(d => sameBounds(d.bounds, original.monitorBounds))?.scaleFactor || 1 : 1 };
    }), blocked: blocked.map(local) };
}

function publishDesktop() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const payload = desktopPayload();
  const suppressed = payload.safeZones.length === 0;
  if (suppressed !== fullscreenSuppressed) {
    fullscreenSuppressed = suppressed;
    if (suppressed) { overlayHitTest = false; overlayControlHitTest = false; }
    syncOverlayVisibility();
  }
  overlayWindow.webContents.send('nova:desktop', payload);
}

async function refreshAvatarLibrary() {
  const result = await discoverAvatars([
    { path: path.join(codexHomePath(), 'pets'), source: 'codex-pet' },
    { path: path.join(app.getAppPath(), 'assets', 'avatars'), source: 'bundled' },
  ]);

  const valid = [];
  const validationErrors = [];
  for (const record of result.avatars) {
    if (record.frameAtlas) {
      const size = await readPngDimensions(record.spritesheetPath);
      if (size?.width === record.frameAtlas.width && size?.height === record.frameAtlas.height) valid.push(record);
      else validationErrors.push({ path: record.manifestPath, message: 'Nova frame map does not match the PNG.' });
      continue;
    }
    const size = await readWebpDimensions(record.spritesheetPath);
    const expectedHeight = record.spriteVersionNumber === 2 ? 2288 : 1872;
    if (!size || size.width !== 1536 || size.height !== expectedHeight) {
      validationErrors.push({
        path: record.manifestPath,
        message: `Expected a 1536x${expectedHeight} atlas, received ${size ? `${size.width}x${size.height}` : 'an unreadable WebP'}.`,
      });
      continue;
    }
    valid.push(record);
  }

  avatarRecords = valid;
  avatarErrors = [...result.errors, ...validationErrors];
  assetPaths = new Map(valid.map((record) => [record.id, record.spritesheetPath]));
  if (capturePath || settingsCapturePath) {
    process.stderr.write(`[nova-fox-companion] discovered=${result.avatars.length} valid=${valid.length} errors=${JSON.stringify(avatarErrors)}\n`);
  }

  if (settingsStore && settings) {
    const allIds = valid.map((avatar) => avatar.id);
    const patch = reconcileAvatarSelection(settings, allIds);
    if (Object.keys(patch).length > 0) settings = await settingsStore.update(patch);
  }

  broadcast('nova:library', { avatars: publicAvatars(), errors: avatarErrors });
  broadcastSettings();
  return { avatars: publicAvatars(), errors: avatarErrors };
}

function broadcast(channel, payload) {
  for (const window of [overlayWindow, settingsWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

function broadcastState() {
  const state = store.snapshot();
  for (const session of state.sessions) knownChatSessions.add(session.id);
  while (knownChatSessions.size > 100) knownChatSessions.delete(knownChatSessions.values().next().value);
  broadcast('nova:state', state);
  companionBrain?.observe(state);
}

function broadcastSettings() {
  if (!settings) return;
  broadcast('nova:settings', settingsPayload(settings));
}

function settingsPayload(value) {
  const displays = currentDisplays();
  return {
    settings: value,
    zone: resolveRoamingZone(value?.zone, displays),
    displays,
  };
}

function previewAvatarSizes(patch) {
  if (!settings || !overlayWindow || overlayWindow.isDestroyed() || overlayWindow.webContents.isDestroyed()) return;
  const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const sizes = {};
  if (Object.hasOwn(source, 'mainAvatarSize')) sizes.mainAvatarSize = source.mainAvatarSize;
  if (Object.hasOwn(source, 'subagentAvatarSize')) sizes.subagentAvatarSize = source.subagentAvatarSize;
  if (Object.keys(sizes).length === 0) return;
  const preview = mergeSettings(settings, sizes);
  overlayWindow.webContents.send('nova:settings', settingsPayload(preview));
}

function metadataTarget(event) {
  if (event.kind === 'agent.started' || event.kind === 'agent.stopped') {
    return { id: event.agentId, isRoot: false };
  }
  if (event.kind.startsWith('session.')) return { id: event.sessionId, isRoot: true };
  return null;
}

function enrichMetadata(event) {
  if (!metadataResolver || event.sessionId.startsWith('demo-')) return;
  const target = metadataTarget(event);
  if (!target || !target.id) return;
  const generation = homeGeneration;
  const key = `${generation}:${event.sessionId}:${target.id}`;
  if (pendingMetadata.has(key)) return;
  pendingMetadata.add(key);
  void metadataResolver.resolve(target.id, { isRoot: target.isRoot, refresh: true }).then((metadata) => {
    if (!metadata || generation !== homeGeneration) return;
    const applied = store.apply({
      kind: 'agent.metadata',
      sessionId: event.sessionId,
      agentId: target.id,
      isRoot: target.isRoot,
      // Root labels are owned exclusively by ThreadTitleMonitor so a slower
      // enrichment read can never overwrite a newer task rename.
      agentLabel: target.isRoot ? null : metadata.label,
      agentNickname: metadata.nickname,
      // A lifecycle event is the freshest source when Codex provides these
      // fields. The local rollout fills only values absent from that event.
      model: event.model ? null : metadata.model,
      effort: event.effort ? null : metadata.effort,
      timestamp: Date.now(),
    });
    if (applied) {
      broadcastState();
    }
  }).catch(() => {}).finally(() => pendingMetadata.delete(key));
}

async function hydrateRecentAgents() {
  if (!metadataResolver) return;
  if (agentActivityRefreshPromise) return agentActivityRefreshPromise;
  const generation = homeGeneration;
  const resolver = metadataResolver;
  agentActivityRefreshPromise = (async () => {
    let records = [];
    try {
      records = await readRecentAgentActivityRecords(resolver.sessionsRoot, {
        cache: recentAgentActivityCache,
        changedOnly: true,
      });
    } catch {
      return;
    }

    if (generation !== homeGeneration) return;
    const { changed, discoveredRoot } = reconcileAgentActivityRecords(store, records);
    if (changed) broadcastState();
    if (discoveredRoot) void threadTitleMonitor?.refresh();
  })().finally(() => {
    agentActivityRefreshPromise = null;
  });
  return agentActivityRefreshPromise;
}

function activeThreadIds() {
  return store.snapshot().sessions.map((session) => session.id);
}

function applyThreadTitles(titles) {
  if (!(titles instanceof Map) || titles.size === 0) return;
  const sessions = new Map(store.snapshot().sessions.map((session) => [session.id, session]));
  let changed = false;
  for (const [sessionId, label] of titles) {
    const session = sessions.get(sessionId);
    const root = session?.agents.find((agent) => agent.isRoot);
    if (!root || !label || root.label === label) continue;
    changed = store.apply({
      kind: 'agent.metadata',
      sessionId,
      agentId: sessionId,
      isRoot: true,
      agentLabel: label,
      timestamp: Date.now(),
    }) || changed;
  }
  if (changed) broadcastState();
}

function handlePayload(payload) {
  if (!matchesCodexHome(payload?.codex_home, codexHomePath())) return;
  lastHookAt = Date.now();
  const event = normalizeHookEvent(payload);
  if ((capturePath || settingsCapturePath) && event) process.stderr.write(`[nova-fox-companion] event=${event.kind}\n`);
  const rootKnown = event
    ? store.hasAgent(event.sessionId, event.sessionId, true)
    : true;
  if (event && store.apply(event)) {
    broadcastState();
    enrichMetadata(event);
    if (!rootKnown) void threadTitleMonitor?.refresh();
  }
}

function attachWindowDiagnostics(window, label) {
  if (!capturePath && !settingsCapturePath && !process.argv.includes('--dev')) return;
  window.webContents.on('console-message', (...args) => {
    const detail = args.find((argument) => argument && typeof argument === 'object' && 'message' in argument);
    const message = detail?.message || args.find((argument) => typeof argument === 'string');
    if (message) process.stderr.write(`[${label}] ${message}\n`);
  });
  window.webContents.on('did-fail-load', (_event, code, description) => {
    process.stderr.write(`[${label}] load failed ${code}: ${description}\n`);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write(`[${label}] renderer gone: ${details.reason}\n`);
  });
}

function updateOverlayInputMode() {
  if (!overlayWindow || overlayWindow.isDestroyed() || !settings) return;
  const ignore = !settings.overlayEnabled || fullscreenSuppressed
    || (!overlayChatOpen && !overlayControlHitTest && (settings.passive || !overlayHitTest));
  overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
}

function sameBounds(left, right) {
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function lockWindowToBounds(window, bounds, label) {
  if (!window || window.isDestroyed()) return false;
  window.setBounds(bounds, false);
  window.setResizable(false);
  window.setMovable(false);
  const actual = window.getBounds();
  if (!sameBounds(actual, bounds)) {
    process.stderr.write(`[${label}] requested bounds ${JSON.stringify(bounds)}, received ${JSON.stringify(actual)}\n`);
    return false;
  }
  return true;
}

function syncOverlayVisibility() {
  if (!overlayWindow || overlayWindow.isDestroyed() || !settings) return;
  if (!settings.overlayEnabled || fullscreenSuppressed) {
    overlayWindow.hide();
    updateOverlayInputMode();
    return;
  }
  overlayWindow.showInactive();
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.moveTop();
  updateOverlayInputMode();
}

async function applySettingsPatch(patch, options = {}) {
  companionBrain?.cancel();
  companionSpeech?.cancel();
  const previousZone = JSON.stringify(settings?.zone);
  const previousHome = codexHomePath();
  settings = await settingsStore.update(patch);
  if (previousHome !== codexHomePath()) {
    homeGeneration += 1;
    if (agentActivityRefreshPromise) await agentActivityRefreshPromise;
    pendingMetadata.clear(); recentAgentActivityCache.clear();
    store = new AgentStore(); lastHookAt = null;
    configureCodexReaders();
    await refreshAvatarLibrary(); await hydrateRecentAgents(); broadcastState();
  }
  overlayHitTest = false;
  updateOverlayInputMode();
  rebuildTrayMenu();
  broadcastSettings();

  if (options.rebuildOverlay || previousZone !== JSON.stringify(settings.zone)) {
    await rebuildOverlayWindow();
  } else {
    syncOverlayVisibility();
  }
  return settings;
}

function createOverlayWindow() {
  const displays = currentDisplays();
  const resolved = resolveRoamingZone(settings?.zone, displays);
  const targetBounds = capturePath
    ? { x: resolved.windowBounds.x, y: resolved.windowBounds.y, width: 1200, height: 700 }
    : resolved.windowBounds;
  const initialBounds = bootstrapWindowBounds(targetBounds, displays);

  overlayChatOpen = false;
  overlayControlHitTest = false;
  overlayWindow = new BrowserWindow({
    ...initialBounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    focusable: true,
    roundedCorners: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload-overlay.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setWindowButtonVisibility?.(false);
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlayWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  attachWindowDiagnostics(overlayWindow, 'overlay');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWindow.once('ready-to-show', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    lockWindowToBounds(overlayWindow, targetBounds, 'overlay');
    syncOverlayVisibility();
    broadcastState();
    broadcastSettings();

    if (capturePath) {
      runDemo();
      setTimeout(() => void captureAndQuit(overlayWindow, capturePath), 2_400);
    }
  });
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

async function rebuildOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
  }
  createOverlayWindow();
}

function settleZonePicker(rectangle) {
  if (!zonePickerResolve) return;
  const resolve = zonePickerResolve;
  const bounds = zonePickerBounds;
  zonePickerResolve = null;
  zonePickerBounds = null;
  if (zonePickerWindow && !zonePickerWindow.isDestroyed()) zonePickerWindow.destroy();
  zonePickerWindow = null;
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
  }
  if (!rectangle || !bounds) {
    resolve(null);
    return;
  }
  resolve(localRectToVirtual(rectangle, bounds));
}

function selectCustomZone() {
  if (zonePickerWindow && !zonePickerWindow.isDestroyed()) {
    zonePickerWindow.focus();
    return Promise.resolve(null);
  }
  const displays = currentDisplays();
  const allDisplays = resolveRoamingZone({ mode: 'all' }, displays);
  zonePickerBounds = allDisplays.windowBounds;
  const initialBounds = bootstrapWindowBounds(zonePickerBounds, displays);
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.hide();

  zonePickerWindow = new BrowserWindow({
    ...initialBounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-zone-picker.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  zonePickerWindow.setAlwaysOnTop(true, 'screen-saver');
  zonePickerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  zonePickerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  zonePickerWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  attachWindowDiagnostics(zonePickerWindow, 'zone-picker');
  zonePickerWindow.loadFile(path.join(__dirname, 'renderer', 'zone-picker.html'), {
    query: { language: settings.language },
  });
  zonePickerWindow.once('ready-to-show', () => {
    if (!zonePickerWindow || zonePickerWindow.isDestroyed()) return;
    lockWindowToBounds(zonePickerWindow, zonePickerBounds, 'zone-picker');
    zonePickerWindow.show();
    zonePickerWindow.focus();
  });
  zonePickerWindow.on('closed', () => {
    zonePickerWindow = null;
    if (zonePickerResolve) settleZonePicker(null);
  });
  return new Promise((resolve) => {
    zonePickerResolve = resolve;
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow;
  settingsWindowScale = 1;
  settingsWindow = new BrowserWindow({
    width: 860,
    height: 780,
    minWidth: 720,
    minHeight: 620,
    title: 'Nova Fox Companion',
    autoHideMenuBar: true,
    backgroundColor: '#0b0b10',
    show: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  settingsWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  attachWindowDiagnostics(settingsWindow, 'settings');
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  settingsWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    cancelMarketplaceGithubConnection();
    settingsWindow.hide();
  });
  settingsWindow.on('closed', () => {
    cancelMarketplaceGithubConnection();
    settingsWindow = null;
  });
  settingsWindow.once('ready-to-show', () => {
    if (!backgroundLaunch && !capturePath && !zonePickerCapturePath) settingsWindow.show();
    if (settingsCapturePath) {
      settingsWindow.show();
      setTimeout(async () => {
        if (settingsScrollArgument === 'submission' || settingsScrollArgument === 'submission-device-code') {
          await settingsWindow.webContents.executeJavaScript(`(() => {
            const select = document.querySelector('#submission-pet');
            const option = [...select.options].find((candidate) => candidate.value);
            if (!option) return false;
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            document.querySelector('#submit-marketplace-pet').click();
            return true;
          })()`);
          if (settingsScrollArgument === 'submission-device-code') {
            await new Promise((resolve) => setTimeout(resolve, 700));
            await settingsWindow.webContents.executeJavaScript(`(() => {
              marketplaceSubmissionOperation = 'connecting';
              setMarketplaceGithubDeviceCode('ABCD-EFGH');
              setMarketplaceSubmissionProgress(c().submissionStage('github-device-code-copied'));
              renderMarketplaceSubmissionStatus();
            })()`);
          }
          setTimeout(() => void captureAndQuit(settingsWindow, settingsCapturePath), 1_000);
          return;
        }
        const scroll = Math.max(0, Math.min(10_000, Number(settingsScrollArgument) || 0));
        if (scroll > 0) await settingsWindow.webContents.executeJavaScript(`window.scrollTo(0, ${scroll})`);
        setTimeout(() => void captureAndQuit(settingsWindow, settingsCapturePath), 120);
      }, 780);
    }
  });
  return settingsWindow;
}

function showSettingsWindow() {
  const window = createSettingsWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

async function captureAndQuit(window, outputPath) {
  try {
    const image = await window.webContents.capturePage();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, image.toPNG());
  } finally {
    isQuitting = true;
    app.quit();
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'))
    .resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip('Nova Fox Companion');
  tray.on('click', () => {
    if (!settings.overlayEnabled) void applySettingsPatch({ overlayEnabled: true });
    else showSettingsWindow();
  });
  if (process.platform === 'win32') {
    scaledTrayMenu = new ScaledTrayMenu({ BrowserWindow, ipcMain });
    tray.on('right-click', () => {
      const point = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(point);
      const scale = nativeDisplayScales.find(d => sameBounds(d, display.bounds))?.scaleFactor || display.scaleFactor;
      scaledTrayMenu.open(point, display.workArea, scale);
    });
  }
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray || !settings) return;
  const french = settings.language === 'fr';
  tray.setToolTip(settings.overlayEnabled
    ? 'Nova Fox Companion'
    : (french ? 'Nova Fox Companion — désactivés' : 'Nova Fox Companion — hidden'));
  const template = [
    {
      label: french ? 'Ouvrir les réglages' : 'Open settings',
      click: showSettingsWindow,
    },
    {
      label: french ? 'Couper la voix du compagnon' : 'Mute companion voice',
      type: 'checkbox',
      checked: settings.companionVoiceMuted,
      click: (item) => void applySettingsPatch({ companionVoiceMuted: item.checked }),
    },
    {
      label: settings.overlayEnabled
        ? (french ? 'Désactiver les avatars' : 'Disable avatars')
        : (french ? 'Activer les avatars' : 'Enable avatars'),
      click: () => void applySettingsPatch({ overlayEnabled: !settings.overlayEnabled }),
    },
    {
      label: french ? 'Mode passif (clics traversants)' : 'Passive mode (click-through)',
      type: 'checkbox',
      checked: settings.passive,
      click: (item) => void applySettingsPatch({ passive: item.checked }),
    },
    { type: 'separator' },
    {
      label: demoSessionId
        ? (french ? 'Arrêter la démo' : 'Stop demo')
        : (french ? 'Lancer la démo' : 'Run demo'),
      click: toggleDemo,
    },
    {
      label: french ? 'Actualiser les avatars' : 'Refresh avatars',
      click: () => void refreshAvatarLibrary(),
    },
    { type: 'separator' },
    {
      label: french ? 'Quitter' : 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];
  if (scaledTrayMenu) scaledTrayMenu.setTemplate(template);
  else tray.setContextMenu(Menu.buildFromTemplate(template));
}

function runDemo() {
  if (demoSessionId) return { running: true, sessionId: demoSessionId };
  const sessionId = `demo-${Date.now()}`;
  demoSessionId = sessionId;
  const base = { session_id: sessionId, cwd: 'C:\\Projects\\tiny-space-station' };
  const emit = (delay, event) => {
    const timer = setTimeout(() => {
      demoTimers.delete(timer);
      if (demoSessionId === sessionId) handlePayload({ ...base, ...event });
    }, delay);
    demoTimers.add(timer);
  };

  emit(0, { hook_event_name: 'SessionStart', agent_name: 'Tiny Space Station', model: 'gpt-5.6-sol', reasoning_effort: 'high' });
  emit(80, { hook_event_name: 'SubagentStart', agent_id: `${sessionId}-1`, agent_type: 'default', agent_name: 'Explorer', model: 'gpt-5.6-terra', reasoning_effort: 'medium' });
  emit(240, { hook_event_name: 'SubagentStart', agent_id: `${sessionId}-2`, agent_type: 'default', agent_name: 'UI builder', model: 'gpt-5.6-terra', reasoning_effort: 'high' });
  emit(400, { hook_event_name: 'SubagentStart', agent_id: `${sessionId}-3`, agent_type: 'default', agent_name: 'Test runner', model: 'gpt-5.6-terra', reasoning_effort: 'medium' });
  const dormantTimer = setTimeout(() => {
    demoTimers.delete(dormantTimer);
    if (demoSessionId !== sessionId) return;
    const timestamp = Date.now();
    const dormantId = `${sessionId}-sleeping`;
    store.apply({
      kind: 'agent.started', sessionId, agentId: dormantId, agentType: 'default',
      agentLabel: 'Dormant architect', model: 'gpt-5.6-terra', effort: 'low', timestamp: timestamp - 8_000,
    });
    store.apply({
      kind: 'agent.stopped', sessionId, agentId: dormantId, agentType: 'default',
      agentLabel: 'Dormant architect', model: 'gpt-5.6-terra', effort: 'low', timestamp: timestamp - 7_500,
    });
    if (store.cleanup(timestamp)) broadcastState();
  }, 620);
  demoTimers.add(dormantTimer);
  emit(5_500, { hook_event_name: 'PermissionRequest' });
  emit(7_000, { hook_event_name: 'UserPromptSubmit' });
  emit(10_000, { hook_event_name: 'SubagentStop', agent_id: `${sessionId}-1`, agent_type: 'explorer' });
  emit(10_400, { hook_event_name: 'SubagentStop', agent_id: `${sessionId}-2`, agent_type: 'ui_builder' });
  emit(10_800, { hook_event_name: 'SubagentStop', agent_id: `${sessionId}-3`, agent_type: 'test_runner' });
  emit(11_200, { hook_event_name: 'Stop' });
  const endTimer = setTimeout(() => {
    demoTimers.delete(endTimer);
    if (demoSessionId === sessionId) stopDemo();
  }, 13_000);
  demoTimers.add(endTimer);
  broadcast('nova:demo', { running: true, sessionId });
  rebuildTrayMenu();
  return { running: true, sessionId };
}

function stopDemo() {
  for (const timer of demoTimers) clearTimeout(timer);
  demoTimers.clear();
  const sessionId = demoSessionId;
  demoSessionId = null;
  if (sessionId) store.removeSession(sessionId);
  broadcastState();
  broadcast('nova:demo', { running: false, sessionId: null });
  rebuildTrayMenu();
  return { running: false, sessionId: null };
}

function toggleDemo() {
  return demoSessionId ? stopDemo() : runDemo();
}

async function settingsBootstrapPayload() {
  let pluginAvailable = true;
  try {
    await fs.access(pluginMarketplacePath());
  } catch {
    pluginAvailable = false;
  }
  return {
    state: store.snapshot(),
    settings,
    avatars: publicAvatars(),
    displays: currentDisplays(),
    zone: currentZone(),
    launchAtLogin: getLaunchAtLogin(app, process.execPath),
    hooks: await hooksStatus(path.join(codexHomePath(), 'hooks.json')).catch((error) => ({ installed: false, error: error.message })),
    version: app.getVersion(),
    settingsCapture: Boolean(settingsCapturePath) && !onboardingCapture,
    demo: { running: Boolean(demoSessionId), sessionId: demoSessionId },
    plugin: {
      available: pluginAvailable,
      onboardingCompleted: settings.onboardingCompleted,
    },
  };
}

function overlayBootstrapPayload() {
  return {
    state: store.snapshot(),
    settings,
    avatars: publicAvatars(),
    zone: currentZone(),
  };
}

function isWindowSender(event, window) {
  return Boolean(
    window
    && !window.isDestroyed()
    && !window.webContents.isDestroyed()
    && event.sender === window.webContents,
  );
}

function requireWindowSender(event, window, role) {
  if (!isWindowSender(event, window)) throw new Error(`IPC access denied for ${role}.`);
}

function registerIpc() {
  ipcMain.handle('nova:control-hit-test', (event, value) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    overlayControlHitTest = Boolean(value); updateOverlayInputMode();
  });
  ipcMain.handle('nova:chat-focus', (event, open) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    overlayChatOpen = Boolean(open);
    updateOverlayInputMode();
    if (open && !fullscreenSuppressed) { overlayWindow.focus(); overlayWindow.webContents.focus(); }
    else overlayWindow.blur();
  });
  ipcMain.handle('nova:open-companion-settings', (event) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    showSettingsWindow();
  });
  ipcMain.handle('nova:open-companion-chat', async (event) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    showSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      await settingsWindow.webContents.executeJavaScript("document.getElementById('nova-chat-log')?.scrollIntoView({block:'center'}); document.getElementById('nova-chat-input')?.focus();");
    }
  });
  ipcMain.handle('nova:open-agent-chat', async (event, sessionId) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    if (typeof sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sessionId)
      || !knownChatSessions.has(sessionId)) return { opened: false };
    await shell.openExternal(`codex://threads/${sessionId}`);
    return { opened: true };
  });
  ipcMain.handle('nova:companion-history', async (event) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    try {
      const memory = await companionBrain.memory.read();
      return { turns: memory.turns.slice(-30), preferredName: memory.preferredName,
        introduction: memory.preferredName ? null : introduction(settings.language) };
    }
    catch { return { turns: [], error: 'Companion memory is unavailable.' }; }
  });
  ipcMain.handle('nova:companion-name', async (event, value) => {
    if (!isWindowSender(event, overlayWindow)) requireWindowSender(event, settingsWindow, 'settings');
    companionBrain.cancel();
    try {
      const profile = await companionBrain.memory.setPreferredName(value, settings.language);
      const result = { ...profile, quip: profile.reply, mood: 'amused', id: `name:${Date.now()}`, expiresAt: Date.now() + 12000 };
      broadcast('nova:companion-profile', { preferredName: profile.preferredName });
      broadcast('nova:companion-conversation', { text: `Call me ${profile.preferredName}.`, result,
        origin: isWindowSender(event, overlayWindow) ? 'overlay' : 'settings' });
      return result;
    } catch { return { error: 'Could not save your name. Use 1–60 characters and check secure memory storage.' }; }
  });
  ipcMain.handle('nova:companion-play', async (event, cue, windowId) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    if (!['moved', 'peeking', 'cursor_play', 'escaped'].includes(cue)) return { skipped: 'Unknown cue.' };
    return companionBrain.generate(null, null, cue, typeof windowId === 'string' ? windowId : null);
  });
  ipcMain.handle('nova:companion-vision-preview', async (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    if (!settings.companionVisionEnabled) return { skipped: 'Enable optional window vision first.' };
    if (!lastForegroundWindowId) return { skipped: 'Focus another app first, then return to Nova.' };
    return companionBrain.generate(null, null, 'peeking', lastForegroundWindowId);
  });
  ipcMain.handle('nova:companion-chat', async (event, text) => {
    if (!isWindowSender(event, overlayWindow)) requireWindowSender(event, settingsWindow, 'settings');
    const result = await companionBrain.generate(null, text);
    if (!result.error && !result.skipped) broadcast('nova:companion-conversation', {
      text: text.trim(), result, origin: isWindowSender(event, overlayWindow) ? 'overlay' : 'settings',
    });
    return result;
  });
  ipcMain.handle('nova:companion-memory', async (event, notes) => {
    requireWindowSender(event, settingsWindow, 'settings');
    if (companionBrain.busy) return { error: 'Wait for the current reaction before changing memory.' };
    companionBrain.cancel();
    try {
      if (notes === null) {
        await companionBrain.memory.clear();
        broadcast('nova:companion-memory-cleared', {});
      }
      else await companionBrain.memory.notes(notes);
      return companionBrain.status();
    } catch { return { error: 'Memory could not be updated.' }; }
  });
  ipcMain.handle('nova:hide-companion', async (event) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    return applySettingsPatch({overlayEnabled:false});
  });
  ipcMain.handle('nova:register-restore-link', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const args = app.isPackaged ? [] : [path.resolve(app.getAppPath())];
    if (profileArgument) args.push(`--profile=${path.resolve(process.cwd(), profileArgument)}`);
    const success = app.setAsDefaultProtocolClient(RESTORE_SCHEME, process.execPath, args);
    return {registered:success, message:success ? 'Restore link enabled. Enable the Nova button in Cursadex settings after installing its update.' : 'Could not register the restore link.'};
  });
  ipcMain.handle('nova:speak-quip', async (event, message) => {
    if (!isWindowSender(event, overlayWindow)) requireWindowSender(event, settingsWindow, 'settings');
    return companionSpeech.speak(message);
  });
  ipcMain.handle('nova:companion-status', async (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return { ...await companionBrain.status(), speech: { usage: companionSpeech.usage, error: companionSpeech.error }, integration: await integrationStatus(), desktopAvailable: desktopSample.available && Date.now() - desktopSample.timestamp < 2200 };
  });
  ipcMain.handle('nova:companion-key', async (event, key) => {
    requireWindowSender(event, settingsWindow, 'settings');
    companionBrain.cancel(); companionSpeech?.cancel();
    try {
      if (key === null) await companionKeys.remove();
      else await companionKeys.save(key);
      return companionBrain.status();
    } catch { return { error: 'Could not save the key. Check the key format and secure OS storage.' }; }
  });
  ipcMain.handle('nova:companion-preview', async (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return companionBrain.generate();
  });
  ipcMain.handle('nova:companion-moved', async (event, sessionId, agentId) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    if (typeof sessionId !== 'string' || typeof agentId !== 'string') return;
    const key = `${sessionId}/${agentId}`;
    const status = companionBrain.previous.get(key);
    if (status && ['working', 'idle', 'done', 'attention', 'dormant'].includes(status)) {
      await companionBrain.generate({ sessionId, agentId, key, status, cue: 'moved' });
    }
  });
  ipcMain.handle('nova:set-voice-muted', async (event, muted) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    await applySettingsPatch({ companionVoiceMuted: Boolean(muted) });
  });
  ipcMain.handle('nova:get-settings-bootstrap', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return settingsBootstrapPayload();
  });
  ipcMain.handle('nova:get-overlay-bootstrap', (event) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    const world = currentZone().windowBounds, bounds = overlayWindow.getBounds();
    return { ...overlayBootstrapPayload(), surface: { x: bounds.x-world.x, y: bounds.y-world.y, width:bounds.width,height:bounds.height, world } };
  });
  ipcMain.handle('nova:overlay-surface', (event, value) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    if (!value || !Array.isArray(value.rects) || value.rects.length > 256) throw new Error('Invalid overlay content bounds');
    const world = currentZone().windowBounds, before = overlayWindow.getBounds();
    if (!value.world || !sameBounds(value.world,world)) return {stale:true};
    const desired = fitSurface(value.rects, world, { x: before.x-world.x, y: before.y-world.y, width: before.width, height: before.height }, value.full === true);
    const next = { x: world.x+desired.x, y: world.y+desired.y, width: desired.width, height: desired.height };
    if (!sameBounds(before,next)) overlayWindow.setBounds(next,false);
    const actual = overlayWindow.getBounds();
    return { x: actual.x-world.x, y: actual.y-world.y, width:actual.width,height:actual.height, world };
  });
  ipcMain.handle('nova:update-settings', (event, patch) => {
    requireWindowSender(event, settingsWindow, 'settings');
    if (patch && Object.hasOwn(patch, 'codexHome')) throw new Error('Use the Codex-home picker.');
    return applySettingsPatch(patch);
  });
  ipcMain.on('nova:preview-avatar-sizes', (event, patch) => {
    if (!isWindowSender(event, settingsWindow)) return;
    previewAvatarSizes(patch);
  });
  ipcMain.handle('nova:set-launch-at-login', (event, value) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return setLaunchAtLogin(app, process.execPath, Boolean(value));
  });
  ipcMain.handle('nova:integration-status', async (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return integrationStatus();
  });
  ipcMain.handle('nova:select-codex-home', async (event, useDefault) => {
    requireWindowSender(event, settingsWindow, 'settings');
    try {
      let selected = null;
      if (!useDefault) {
        const choice = await dialog.showOpenDialog(settingsWindow, { title: 'Select an existing Codex home',
          defaultPath: codexHomePath(), properties: ['openDirectory'] });
        if (choice.canceled || !choice.filePaths[0]) return { canceled: true };
        selected = await validateCodexHome(choice.filePaths[0]);
      }
      // Do not silently strand installed hooks in the previous home.
      const oldHooks = await hooksStatus(path.join(codexHomePath(), 'hooks.json'));
      if (oldHooks.installed && !matchesCodexHome(resolveCodexHome(selected).path, codexHomePath())) {
        return { error: 'Remove Nova hooks from the current home before switching. Other homes are never modified automatically.' };
      }
      await applySettingsPatch({ codexHome: selected });
      return integrationStatus();
    } catch (error) { return { error: error.message }; }
  });
  ipcMain.handle('nova:install-hooks', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return installHooks(hookScriptPath(), path.join(codexHomePath(), 'hooks.json'));
  });
  ipcMain.handle('nova:uninstall-hooks', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return uninstallHooks(path.join(codexHomePath(), 'hooks.json'));
  });
  ipcMain.handle('nova:hooks-status', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return hooksStatus(path.join(codexHomePath(), 'hooks.json'));
  });
  ipcMain.handle('nova:refresh-library', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return refreshAvatarLibrary();
  });
  ipcMain.handle('nova:open-feedback', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return openFeedback();
  });
  ipcMain.handle('nova:get-marketplace', (event, options) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return loadMarketplace(Boolean(options?.force));
  });
  ipcMain.handle('nova:get-marketplace-thumbnail', (event, slug) => {
    requireWindowSender(event, settingsWindow, 'settings');
    if (!marketplaceClient) throw new Error('The marketplace is not ready yet.');
    return marketplaceClient.thumbnail(slug, { signal: AbortSignal.timeout(12_000) });
  });
  ipcMain.handle('nova:install-marketplace-pet', (event, slug) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return installMarketplacePet(slug);
  });
  ipcMain.handle('nova:open-marketplace', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return shell.openExternal(CATALOG_SITE_URL);
  });
  ipcMain.handle('nova:open-marketplace-pet', async (event, slug) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const safeSlug = safeCatalogSlug(slug);
    const record = await marketplaceClient.record(safeSlug, { signal: AbortSignal.timeout(12_000) });
    return shell.openExternal(record.detailsUrl);
  });
  ipcMain.handle('nova:report-marketplace-pet', (event, slug, payload) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return openMarketplacePetReport(slug, payload);
  });
  ipcMain.handle('nova:open-submission-guide', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return shell.openExternal(CATALOG_GUIDE_URL);
  });
  ipcMain.handle('nova:get-marketplace-submission-status', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return marketplaceSubmissionStatus();
  });
  ipcMain.handle('nova:connect-marketplace-github', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return connectMarketplaceGithub();
  });
  ipcMain.handle('nova:open-marketplace-github-authorization', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return shell.openExternal(GITHUB_DEVICE_AUTHORIZATION_URL);
  });
  ipcMain.handle('nova:copy-marketplace-github-device-code', (event, value) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const code = normalizeGitHubDeviceCode(value);
    if (!code) throw new Error('GitHub returned an invalid one-time code.');
    clipboard.writeText(code);
    return { copied: true };
  });
  ipcMain.handle('nova:cancel-marketplace-github', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return cancelMarketplaceGithubConnection();
  });
  ipcMain.handle('nova:submit-marketplace-pet', (event, payload) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return submitMarketplacePetDirectly(payload);
  });
  ipcMain.handle('nova:overlay-hit-test', (event, value) => {
    requireWindowSender(event, overlayWindow, 'overlay');
    overlayHitTest = Boolean(value);
    updateOverlayInputMode();
    return settings.overlayEnabled && !settings.passive && overlayHitTest;
  });
  ipcMain.handle('nova:create-avatar', async (event, brief) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const prompt = buildAvatarPrompt(brief, settings.language);
    const url = codexNewThreadUrl(prompt);
    try {
      await shell.openExternal(url);
      return { opened: true, copied: false, url };
    } catch (error) {
      clipboard.writeText(prompt);
      return { opened: false, copied: true, message: error.message };
    }
  });
  ipcMain.handle('nova:copy-create-prompt', (event, brief) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const prompt = buildAvatarPrompt(brief, settings.language);
    clipboard.writeText(prompt);
    return prompt;
  });
  ipcMain.handle('nova:pick-zone', async (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const rectangle = await selectCustomZone();
    if (!rectangle) return { cancelled: true };
    const next = await applySettingsPatch({ zone: { mode: 'custom', custom: rectangle } }, { rebuildOverlay: true });
    return { cancelled: false, rectangle, settings: next };
  });
  ipcMain.handle('nova:zone-picker-complete', (event, rectangle) => {
    requireWindowSender(event, zonePickerWindow, 'zone picker');
    settleZonePicker(rectangle);
    return true;
  });
  ipcMain.handle('nova:zone-picker-cancel', (event) => {
    requireWindowSender(event, zonePickerWindow, 'zone picker');
    settleZonePicker(null);
    return true;
  });
  ipcMain.handle('nova:import-pet', async (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const options = {
      title: settings.language === 'fr' ? 'Importer un Pet' : 'Import a Pet',
      properties: ['openFile'],
      filters: [
        { name: 'Codex Pet package', extensions: ['codexpet', 'zip'] },
        { name: 'All files', extensions: ['*'] },
      ],
    };
    const result = settingsWindow && !settingsWindow.isDestroyed()
      ? await dialog.showOpenDialog(settingsWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    const imported = await importPetPackage(result.filePaths[0], path.join(codexHomePath(), 'pets'));
    await refreshAvatarLibrary();
    return { cancelled: false, imported };
  });
  ipcMain.handle('nova:export-pet', async (event, avatarId) => {
    requireWindowSender(event, settingsWindow, 'settings');
    const record = avatarRecords.find((avatar) => avatar.id === avatarId);
    if (!record) throw new Error('The selected Pet is no longer available.');
    if (record.frameAtlas) throw new Error('Nova uses a bundled animation map, not an exportable native Codex Pet package.');
    const options = {
      title: settings.language === 'fr' ? 'Partager ce Pet' : 'Share this Pet',
      defaultPath: `${record.id}.codexpet`,
      filters: [{ name: 'Codex Pet package', extensions: ['codexpet'] }],
    };
    const result = settingsWindow && !settingsWindow.isDestroyed()
      ? await dialog.showSaveDialog(settingsWindow, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { cancelled: true };
    await exportPetPackage(record, result.filePath);
    return { cancelled: false, filePath: result.filePath };
  });
  ipcMain.handle('nova:open-pets-doc', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return shell.openExternal('https://learn.chatgpt.com/docs/pets');
  });
  ipcMain.handle('nova:open-plugin', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return openPluginInCodex();
  });
  ipcMain.handle('nova:open-pet-directory', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return shell.openPath(path.join(codexHomePath(), 'pets'));
  });
  ipcMain.handle('nova:demo', (event) => {
    requireWindowSender(event, settingsWindow, 'settings');
    return toggleDemo();
  });
}

function configureCodexReaders() {
  threadTitleMonitor?.close();
  metadataResolver = new AgentMetadataResolver(path.join(codexHomePath(), 'sessions'));
  threadTitleMonitor = new ThreadTitleMonitor(metadataResolver.threadIndexPath, {
    getThreadIds: activeThreadIds,
    readTitles: (threadIds) => metadataResolver.refreshThreadNames(threadIds),
    onTitles: applyThreadTitles,
  });
  threadTitleMonitor.start();
}

async function integrationStatus() {
  const home = resolveCodexHome(settings?.codexHome);
  let available = false;
  try { available = (await fs.stat(home.path)).isDirectory(); } catch { }
  let hooks;
  try { hooks = await hooksStatus(path.join(home.path, 'hooks.json')); }
  catch (error) { hooks = { installed: false, error: error.message }; }
  return { home: home.path, source: home.source, available, hooks, bridgeError, lastHookAt,
    bridge: bridgeError ? 'unavailable' : 'listening',
    help: 'Waiting for events is normal when Codex is closed or idle. Nova never launches Codex automatically.' };
}

async function listenForHooks() {
  try { await eventServer.listen(); bridgeError = null; }
  catch { bridgeError = 'Nova’s local bridge is unavailable or already in use. Retrying in 5 seconds.'; }
}

async function startApplication() {
  app.setAppUserModelId('dev.novafoxcompanion.desktop');
  normalizeLaunchAtLogin(app, process.execPath);
  settingsStore = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  settings = await settingsStore.load();
  registerFreshRestoreLink({ app, isNewProfile: settingsStore.isNewProfile,
    normalLaunch: !profileArgument && !capturePath && !settingsCapturePath && !zonePickerCapturePath
      && !process.argv.includes('--offline-smoke'),
    executable: process.execPath, appPath: app.getAppPath() });
  companionKeys = new CompanionKeyStore(path.join(app.getPath('userData'), 'companion-key.json'), safeStorage);
  companionBrain = new CompanionBrain({ directory: app.getPath('userData'), keys: companionKeys,
    memory: new CompanionMemory(path.join(app.getPath('userData'), 'companion-memory.json'), safeStorage),
    capture: async (id, signal) => {
      const window = allowedWindow(desktopSample, id, settings.companionVisionExcludedApps);
      if (!settings.companionVisionEnabled || !window || blockedDisplays([window], currentDisplays()).length) return null;
      return captureWindow({ script: app.isPackaged ? path.join(process.resourcesPath, 'hooks', 'capture-window.ps1')
        : path.join(app.getAppPath(), 'scripts', 'capture-window.ps1'), window, signal });
    },
    getSettings: () => settings, emit: (reaction) => broadcast('nova:reaction', reaction) });
  await companionBrain.load();
  companionSpeech = new CompanionSpeech({ directory: app.getPath('userData'), keys: companionKeys, getSettings: () => settings });
  await companionSpeech.load();
  companionBrain.observe(store.snapshot());
  marketplaceClient = new MarketplaceClient({
    cacheDirectory: path.join(app.getPath('userData'), 'marketplace-cache'),
    renderThumbnail: (spritesheet) => {
      const atlas = nativeImage.createFromBuffer(spritesheet);
      const size = atlas.getSize();
      if (atlas.isEmpty() || size.width !== 1536 || size.height !== 2288) {
        throw new Error('The marketplace thumbnail source is not a native V2 atlas.');
      }
      return atlas
        .crop({ x: 0, y: 0, width: 192, height: 208 })
        .resize({ width: 384, height: 416, quality: 'best' })
        .toPNG();
    },
  });
  githubCli = new GitHubCli({
    toolDirectory: path.join(app.getPath('userData'), 'tools', 'github-cli'),
    configDirectory: path.join(app.getPath('userData'), 'github-cli-config'),
  });
  githubPublisher = new GitHubMarketplacePublisher({ github: githubCli });
  configureCodexReaders();

  protocol.handle('nova-fox-companion', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'asset') return new Response('Not found', { status: 404 });
      const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const assetPath = assetPaths.get(id);
      if (!assetPath) return new Response('Not found', { status: 404 });
      const data = await fs.readFile(assetPath);
      return new Response(data, { headers: { 'content-type': assetPath.endsWith('.png') ? 'image/png' : 'image/webp', 'cache-control': 'no-store' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  registerIpc();
  await refreshAvatarLibrary();
  await listenForHooks();
  bridgeRetryTimer = setInterval(() => { if (bridgeError) void listenForHooks(); }, 5000);
  await hydrateRecentAgents();
  createTray();
  createOverlayWindow();
  createSettingsWindow();
  desktopSensor = new DesktopSensor({
    script: app.isPackaged ? path.join(process.resourcesPath, 'hooks', 'desktop-sensor.ps1')
      : path.join(app.getAppPath(), 'scripts', 'desktop-sensor.ps1'),
    convert: (rect) => screen.screenToDipRect(null, rect),
    onSample: (sample) => {
      nativeDisplayScales = sample.scales || nativeDisplayScales;
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        const matched = screen.getDisplayMatching(settingsWindow.getBounds());
        const scale = nativeDisplayScales.find(d => sameBounds(d, matched.bounds))?.scaleFactor || 1;
        if (scale !== settingsWindowScale) {
          const ratio = scale / settingsWindowScale, before = settingsWindow.getBounds();
          settingsWindow.webContents.setZoomFactor(scale);
          settingsWindow.setMinimumSize(Math.round(720*scale),Math.round(620*scale));
          settingsWindow.setSize(Math.min(matched.workArea.width, Math.round(before.width*ratio)),Math.min(matched.workArea.height, Math.round(before.height*ratio)));
          settingsWindow.center(); settingsWindowScale = scale;
        }
      }
      desktopSample = sample;
      lastForegroundWindowId = sample.windows.find((window) => window.foreground)?.id || lastForegroundWindowId;
      publishDesktop();
    },
  });
  if (!capturePath && !settingsCapturePath) desktopSensor.start();
  desktopTimer = setInterval(publishDesktop, 100);
  void promptForUpdate();

  if (zonePickerCapturePath) {
    void selectCustomZone();
    setTimeout(() => {
      if (zonePickerWindow && !zonePickerWindow.isDestroyed()) {
        void captureAndQuit(zonePickerWindow, zonePickerCapturePath);
      }
    }, 850);
  }

  globalShortcut.register('CommandOrControl+Alt+A', () => {
    void applySettingsPatch({ passive: !settings.passive });
  });

  const handleDisplayChange = () => {
    broadcastSettings();
    void rebuildOverlayWindow();
  };
  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
  screen.on('display-metrics-changed', handleDisplayChange);

  cleanupTimer = setInterval(() => {
    if (store.cleanup()) broadcastState();
  }, 1_000);
  agentActivityTimer = setInterval(() => void hydrateRecentAgents(), 1_500);
  avatarRefreshTimer = setInterval(() => void refreshAvatarLibrary(), 5_000);
  if (process.argv.some(isRestoreLink)) await applySettingsPatch({overlayEnabled:true});
}

if (commandLineAction) {
  app.whenReady().then(async () => {
    try {
      settingsStore = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
      settings = await settingsStore.load();
      if (commandLineAction === 'install') await installHooks(hookScriptPath(), path.join(codexHomePath(), 'hooks.json'));
      else await uninstallHooks(path.join(codexHomePath(), 'hooks.json'));
      app.exit(0);
    } catch {
      app.exit(1);
    }
  });
} else {
  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) app.quit();

  if (hasLock) {
    app.on('second-instance', (_event, argv) => {
      if (argv.some(isRestoreLink)) {
        if (settingsStore) void applySettingsPatch({overlayEnabled:true});
      } else showSettingsWindow();
    });
    app.on('open-url', (event, url) => {event.preventDefault();if(isRestoreLink(url)&&settingsStore)void applySettingsPatch({overlayEnabled:true});});
    app.on('activate', showSettingsWindow);
    app.whenReady().then(startApplication);
  }
}

app.on('window-all-closed', () => {
  // The tray owns the process lifetime. Closing settings never removes the avatars.
});
app.on('before-quit', () => {
  companionBrain?.cancel(); companionSpeech?.cancel();
  isQuitting = true;
});
app.on('will-quit', () => {
  scaledTrayMenu?.dispose();
  desktopSensor?.stop();
  if (desktopTimer) clearInterval(desktopTimer);
  if (bridgeRetryTimer) clearInterval(bridgeRetryTimer);
  if (cleanupTimer) clearInterval(cleanupTimer);
  if (agentActivityTimer) clearInterval(agentActivityTimer);
  if (avatarRefreshTimer) clearInterval(avatarRefreshTimer);
  if (threadTitleMonitor) threadTitleMonitor.close();
  for (const timer of demoTimers) clearTimeout(timer);
  demoTimers.clear();
  globalShortcut.unregisterAll();
  void eventServer.close();
});
