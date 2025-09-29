// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Expose APIs to renderer
contextBridge.exposeInMainWorld("electronAPI", {
  toggleFullscreen: () => ipcRenderer.send("toggle-fullscreen"),
  openModule: (modulePath) => ipcRenderer.send("open-module", modulePath),
  exitApp: () => ipcRenderer.send("app-exit"),
});

// 🔥 Forward all console logs/errors to main -> dev window
function hookConsole() {
  const oldLog = console.log;
  const oldErr = console.error;

  console.log = (...args) => {
    oldLog(...args);
    ipcRenderer.send("devtools-log", { type: "log", args });
  };

  console.error = (...args) => {
    oldErr(...args);
    ipcRenderer.send("devtools-log", { type: "error", args });
  };

  window.onerror = (msg, src, line, col, err) => {
    ipcRenderer.send("devtools-log", {
      type: "uncaught",
      msg,
      src,
      line,
      col,
      stack: err?.stack,
    });
  };
}

hookConsole();
