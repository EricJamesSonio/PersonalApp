const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require("electron");
const path = require("path");

let mainWin;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // always inject preload
    },
  });

  mainWin.loadFile(path.join(__dirname, "index.html"));
  mainWin.setMenuBarVisibility(false);

  // Start maximized
  mainWin.maximize();

  // IPC handlers
  ipcMain.on("toggle-fullscreen", () => {
    if (mainWin) mainWin.setFullScreen(!mainWin.isFullScreen());
  });

  ipcMain.on("open-module", (event, modulePath) => {
    // modulePath = "Frontend/noteTracker" or "Frontend/repoTracker"
    const filePath = path.join(__dirname, modulePath, "views/index.html");
    console.log("Opening module:", filePath); // 🔎 debug
    mainWin.loadFile(filePath);
  });

  ipcMain.on("app-exit", () => {
    app.quit();
  });
}

app.whenReady().then(() => {
  createMainWindow();

  // Shortcut: open real Chromium DevTools with Ctrl+Shift+I
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWin) {
      if (mainWin.webContents.isDevToolsOpened()) {
        mainWin.webContents.closeDevTools();
      } else {
        mainWin.webContents.openDevTools({ mode: "detach" }); // open in separate window
      }
    }
  });

  // Hide default app menu (you can remove this line to get the default DevTools shortcut back)
  const menu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
