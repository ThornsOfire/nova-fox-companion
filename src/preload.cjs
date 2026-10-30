'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('novaFoxCompanion', {
  getBootstrap: () => ipcRenderer.invoke('nova:get-settings-bootstrap'),
  integrationStatus: () => ipcRenderer.invoke('nova:integration-status'),
  selectCodexHome: (useDefault = false) => ipcRenderer.invoke('nova:select-codex-home', Boolean(useDefault)),
  companionStatus: () => ipcRenderer.invoke('nova:companion-status'),
  registerRestoreLink: () => ipcRenderer.invoke('nova:register-restore-link'),
  speakQuip: (message) => ipcRenderer.invoke('nova:speak-quip', {id: message.id, quip: message.quip}),
  onReaction: (callback) => subscribe('nova:reaction', callback),
  onConversation: (callback) => subscribe('nova:companion-conversation', callback),
  setCompanionName: (name) => ipcRenderer.invoke('nova:companion-name', name),
  onProfile: (callback) => subscribe('nova:companion-profile', callback),
  chatCompanion: (text) => ipcRenderer.invoke('nova:companion-chat', text),
  updateCompanionMemory: (notes) => ipcRenderer.invoke('nova:companion-memory', notes),
  setCompanionKey: (key) => ipcRenderer.invoke('nova:companion-key', key),
  previewCompanion: () => ipcRenderer.invoke('nova:companion-preview'),
  previewCompanionVision: () => ipcRenderer.invoke('nova:companion-vision-preview'),
  updateSettings: (patch) => ipcRenderer.invoke('nova:update-settings', patch),
  previewAvatarSizes: (patch) => ipcRenderer.send('nova:preview-avatar-sizes', patch),
  setLaunchAtLogin: (value) => ipcRenderer.invoke('nova:set-launch-at-login', Boolean(value)),
  installHooks: () => ipcRenderer.invoke('nova:install-hooks'),
  uninstallHooks: () => ipcRenderer.invoke('nova:uninstall-hooks'),
  hooksStatus: () => ipcRenderer.invoke('nova:hooks-status'),
  refreshLibrary: () => ipcRenderer.invoke('nova:refresh-library'),
  openFeedback: () => ipcRenderer.invoke('nova:open-feedback'),
  getMarketplace: (options) => ipcRenderer.invoke('nova:get-marketplace', options),
  getMarketplaceThumbnail: (slug) => ipcRenderer.invoke('nova:get-marketplace-thumbnail', slug),
  installMarketplacePet: (slug) => ipcRenderer.invoke('nova:install-marketplace-pet', slug),
  openMarketplace: () => ipcRenderer.invoke('nova:open-marketplace'),
  openMarketplacePet: (slug) => ipcRenderer.invoke('nova:open-marketplace-pet', slug),
  reportMarketplacePet: (slug, payload) => ipcRenderer.invoke('nova:report-marketplace-pet', slug, payload),
  openSubmissionGuide: () => ipcRenderer.invoke('nova:open-submission-guide'),
  getMarketplaceSubmissionStatus: () => ipcRenderer.invoke('nova:get-marketplace-submission-status'),
  connectMarketplaceGithub: () => ipcRenderer.invoke('nova:connect-marketplace-github'),
  openMarketplaceGithubAuthorization: () => ipcRenderer.invoke('nova:open-marketplace-github-authorization'),
  copyMarketplaceGithubDeviceCode: (code) => ipcRenderer.invoke('nova:copy-marketplace-github-device-code', code),
  cancelMarketplaceGithub: () => ipcRenderer.invoke('nova:cancel-marketplace-github'),
  submitMarketplacePet: (payload) => ipcRenderer.invoke('nova:submit-marketplace-pet', payload),
  createAvatar: (brief) => ipcRenderer.invoke('nova:create-avatar', brief),
  copyCreatePrompt: (brief) => ipcRenderer.invoke('nova:copy-create-prompt', brief),
  pickCustomZone: () => ipcRenderer.invoke('nova:pick-zone'),
  importPet: () => ipcRenderer.invoke('nova:import-pet'),
  exportPet: (avatarId) => ipcRenderer.invoke('nova:export-pet', avatarId),
  openPlugin: () => ipcRenderer.invoke('nova:open-plugin'),
  openPetsDocs: () => ipcRenderer.invoke('nova:open-pets-doc'),
  openPetDirectory: () => ipcRenderer.invoke('nova:open-pet-directory'),
  runDemo: () => ipcRenderer.invoke('nova:demo'),
  onState: (callback) => subscribe('nova:state', callback),
  onSettings: (callback) => subscribe('nova:settings', callback),
  onLibrary: (callback) => subscribe('nova:library', callback),
  onDemo: (callback) => subscribe('nova:demo', callback),
  onMarketplaceSubmissionProgress: (callback) => subscribe('nova:marketplace-submission-progress', callback),
});
