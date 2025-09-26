const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  toggleFullscreen: () => ipcRenderer.send("toggle-fullscreen"),
  openModule: (modulePath) => ipcRenderer.send("open-module", modulePath)
});
