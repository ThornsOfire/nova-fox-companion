'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('novaFoxCompanion', {
  completeZoneSelection: (rectangle) => ipcRenderer.invoke('nova:zone-picker-complete', rectangle),
  cancelZoneSelection: () => ipcRenderer.invoke('nova:zone-picker-cancel'),
});
