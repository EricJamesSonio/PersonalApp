const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  toggleFullscreen: () => ipcRenderer.send("toggle-fullscreen"),
  openModule: (modulePath) => ipcRenderer.send("open-module", modulePath),
  exitApp: () => ipcRenderer.send("app-exit") // for Exit button
});
