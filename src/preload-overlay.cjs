'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('novaFoxCompanion', {
  getBootstrap: () => ipcRenderer.invoke('nova:get-overlay-bootstrap'),
  setOverlaySurface: (value) => ipcRenderer.invoke('nova:overlay-surface', value),
  onDesktop: (callback) => subscribe('nova:desktop', callback),
  onConversation: (callback) => subscribe('nova:companion-conversation', callback),
  onMemoryCleared: (callback) => subscribe('nova:companion-memory-cleared', callback),
  setControlHitTest: (value) => ipcRenderer.invoke('nova:control-hit-test', Boolean(value)),
  setChatFocus: (value) => ipcRenderer.invoke('nova:chat-focus', Boolean(value)),
  openSettings: () => ipcRenderer.invoke('nova:open-companion-settings'),
  openFullChat: () => ipcRenderer.invoke('nova:open-companion-chat'),
  openAgentChat: (sessionId) => ipcRenderer.invoke('nova:open-agent-chat', sessionId),
  companionHistory: () => ipcRenderer.invoke('nova:companion-history'),
  setCompanionName: (name) => ipcRenderer.invoke('nova:companion-name', name),
  onProfile: (callback) => subscribe('nova:companion-profile', callback),
  chatCompanion: (text) => ipcRenderer.invoke('nova:companion-chat', text),
  playReaction: (cue, windowId) => ipcRenderer.invoke('nova:companion-play', cue, windowId),
  hideCompanion: () => ipcRenderer.invoke('nova:hide-companion'),
  speakQuip: (message) => ipcRenderer.invoke('nova:speak-quip', {id: message.id, quip: message.quip}),
  onReaction: (callback) => subscribe('nova:reaction', callback),
  companionMoved: (sessionId, agentId) => ipcRenderer.invoke('nova:companion-moved', sessionId, agentId),
  setVoiceMuted: (muted) => ipcRenderer.invoke('nova:set-voice-muted', Boolean(muted)),
  setOverlayHitTest: (value) => ipcRenderer.invoke('nova:overlay-hit-test', Boolean(value)),
  onState: (callback) => subscribe('nova:state', callback),
  onSettings: (callback) => subscribe('nova:settings', callback),
  onLibrary: (callback) => subscribe('nova:library', callback),
});
