const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");

let mainWin;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWin.loadFile("index.html");
  mainWin.setMenuBarVisibility(false);

  ipcMain.on("toggle-fullscreen", () => {
    if (mainWin) mainWin.setFullScreen(!mainWin.isFullScreen());
  });
}

function openModule(modulePath) {
  const moduleWin = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: true,
    fullscreen: false,
    webPreferences: {
      preload: path.join(__dirname, modulePath, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  moduleWin.loadFile(path.join(__dirname, modulePath, "views/index.html"));
  moduleWin.setMenuBarVisibility(false);

  // Only attach once per module window
  const toggleListener = () => {
    moduleWin.setFullScreen(!moduleWin.isFullScreen());
  };
  ipcMain.once("toggle-fullscreen-module", toggleListener);

  moduleWin.on("closed", () => {
    ipcMain.removeListener("toggle-fullscreen-module", toggleListener);
  });
}

app.whenReady().then(() => {
  createMainWindow();
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

// Add this inside app.whenReady() in main.js
ipcMain.on('open-module', (event, modulePath) => {
  openModule(modulePath);
});

