'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('codexAvatars', {
  getBootstrap: () => ipcRenderer.invoke('avatars:get-overlay-bootstrap'),
  onDesktop: (callback) => subscribe('avatars:desktop', callback),
  onConversation: (callback) => subscribe('avatars:companion-conversation', callback),
  onMemoryCleared: (callback) => subscribe('avatars:companion-memory-cleared', callback),
  setControlHitTest: (value) => ipcRenderer.invoke('avatars:control-hit-test', Boolean(value)),
  setChatFocus: (value) => ipcRenderer.invoke('avatars:chat-focus', Boolean(value)),
  openSettings: () => ipcRenderer.invoke('avatars:open-companion-settings'),
  openFullChat: () => ipcRenderer.invoke('avatars:open-companion-chat'),
  openAgentChat: (sessionId) => ipcRenderer.invoke('avatars:open-agent-chat', sessionId),
  companionHistory: () => ipcRenderer.invoke('avatars:companion-history'),
  chatCompanion: (text) => ipcRenderer.invoke('avatars:companion-chat', text),
  playReaction: (cue, windowId) => ipcRenderer.invoke('avatars:companion-play', cue, windowId),
  onReaction: (callback) => subscribe('avatars:reaction', callback),
  companionMoved: (sessionId, agentId) => ipcRenderer.invoke('avatars:companion-moved', sessionId, agentId),
  setVoiceMuted: (muted) => ipcRenderer.invoke('avatars:set-voice-muted', Boolean(muted)),
  setOverlayHitTest: (value) => ipcRenderer.invoke('avatars:overlay-hit-test', Boolean(value)),
  onState: (callback) => subscribe('avatars:state', callback),
  onSettings: (callback) => subscribe('avatars:settings', callback),
  onLibrary: (callback) => subscribe('avatars:library', callback),
});
