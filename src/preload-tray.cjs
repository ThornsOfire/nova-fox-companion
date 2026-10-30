'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('novaTray', {
  choose: index => ipcRenderer.send('nova:tray-menu-action', index),
  onContent: callback => ipcRenderer.on('nova:tray-menu-content', (_event, items) => callback(items)),
});
