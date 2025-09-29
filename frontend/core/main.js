const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require("electron");
const path = require("path");

let mainWin;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // frontend/core/preload.js
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
  });

  // Landing page = frontend/core/index.html
  mainWin.loadFile(path.join(__dirname, "index.html"));
  mainWin.setMenuBarVisibility(false);
  mainWin.maximize();

  // IPC handlers
  ipcMain.on("toggle-fullscreen", () => {
    if (mainWin) mainWin.setFullScreen(!mainWin.isFullScreen());
  });

  ipcMain.on("open-module", (event, moduleName) => {
    // Example: moduleName = "noteTracker" or "repoTracker"
    const filePath = path.join(
      __dirname,
      "..",              // out of core/
      "modules",
      moduleName,
      "views",
      "index.html"
    );
    console.log("Opening module:", filePath);
    mainWin.loadFile(filePath);
  });

  ipcMain.on("app-exit", () => app.quit());
}

app.whenReady().then(() => {
  createMainWindow();

  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWin) {
      if (mainWin.webContents.isDevToolsOpened()) {
        mainWin.webContents.closeDevTools();
      } else {
        mainWin.webContents.openDevTools({ mode: "detach" });
      }
    }
  });

  const menu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
