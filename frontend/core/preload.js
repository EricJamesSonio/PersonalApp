const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

// 🌐 Global constants
const API_BASE = "http://localhost:4000";

let initTerminalFn = null; // will hold reference once terminal.js is ready
let initTerminalQueue = []; // queue of calls waiting for initTerminal

// forward logs…
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

// ✅ Expose APIs & globals to renderer (only once)
contextBridge.exposeInMainWorld("electronAPI", {
  toggleFullscreen: () => ipcRenderer.send("toggle-fullscreen"),
  openModule: (moduleName) => ipcRenderer.send("open-module", moduleName),
  exitApp: () => ipcRenderer.send("app-exit"),

  API_BASE,

  // Renderer calls this once terminal.js is ready
  registerInitTerminal: (fn) => {
    console.log("📢 registerInitTerminal called, binding initTerminalFn");
    initTerminalFn = fn;

    // flush queued calls
    console.log("📢 Flushing", initTerminalQueue.length, "queued initTerminal calls");
    initTerminalQueue.forEach(({ options, resolve }) => {
      const instance = initTerminalFn(options);
      window.terminalInstance = instance;
      resolve(instance);
    });
    initTerminalQueue = [];
  },

  // ✅ Promise-based wrapper for initTerminal
  initTerminal: (options) => {
    console.log("📢 electronAPI.initTerminal called, initTerminalFn =", initTerminalFn);
    if (typeof initTerminalFn === "function") {
      console.log("📢 initTerminalFn is ready, calling it now");
      const instance = initTerminalFn(options);
      window.terminalInstance = instance; // 🔑 set global immediately
      return Promise.resolve(instance);
    }
    console.warn("⚠️ initTerminal not ready yet, queuing call");
    return new Promise((resolve) => {
      initTerminalQueue.push({ options, resolve });
    });
  },
});

// ✅ Load terminal.js and hook its initTerminal
window.addEventListener("DOMContentLoaded", () => {
  try {
    const scriptPath = path.join(__dirname, "..", "terminal", "terminal.js");
    const script = document.createElement("script");
    script.src = "file://" + scriptPath.replace(/\\/g, "/");

    console.log("📢 Injecting terminal.js from", script.src);

    script.onload = () => {
      console.log("✅ terminal.js loaded via preload");
      console.log("📢 Checking for window.initTerminal…", typeof window.initTerminal);

      if (typeof window.initTerminal === "function") {
        // In case terminal.js didn’t call registerInitTerminal itself
        console.log("✅ window.initTerminal is a function, binding directly");
        window.electronAPI.registerInitTerminal(window.initTerminal);
      } else {
        console.warn("⚠️ terminal.js loaded but window.initTerminal is MISSING");
        console.warn(
          "📢 Current window keys:",
          Object.keys(window).filter((k) => k.includes("init"))
        );
      }
    };

    script.onerror = (err) => console.error("❌ Failed to load terminal.js", err);

    document.body.appendChild(script);
  } catch (err) {
    console.error("❌ Exception injecting terminal.js", err);
  }
});
