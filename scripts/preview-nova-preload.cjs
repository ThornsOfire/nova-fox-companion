'use strict';
// Isolated renderer fixture. Never used by the installed application.
const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => ipcRenderer.on(channel, (_event, value) => callback(value));
contextBridge.exposeInMainWorld('novaFoxCompanion', {
  getBootstrap: () => ipcRenderer.invoke('fixture:bootstrap'),
  setOverlaySurface: (value) => ipcRenderer.invoke('fixture:surface', value),
  companionHistory: () => ipcRenderer.invoke('fixture:history'),
  setCompanionName: (name) => ipcRenderer.invoke('fixture:name', name),
  setOverlayHitTest: async () => {}, setControlHitTest: async () => {}, setChatFocus: async () => {},
  setVoiceMuted: async () => {}, openSettings: async () => {}, openFullChat: async () => {}, openAgentChat: async () => {},
  companionMoved: async () => {}, playReaction: async () => ({ skipped: 'Isolated preview' }),
  chatCompanion: async (text) => ({ id: `preview:${Date.now()}`, quip: `I heard you. Supervisory ears are operational.`, mood: 'amused', expiresAt: Date.now() + 8000 }),
  onState: (callback) => subscribe('fixture:state', callback),
  onSettings: (callback) => subscribe('fixture:settings', callback),
  onLibrary: (callback) => subscribe('fixture:library', callback),
  onReaction: (callback) => subscribe('fixture:reaction', callback),
  onDesktop: (callback) => subscribe('fixture:desktop', callback),
  onProfile: (callback) => subscribe('fixture:profile', callback),
  onConversation: (callback) => subscribe('fixture:conversation', callback),
  onMemoryCleared: (callback) => subscribe('fixture:memory-cleared', callback),
});
