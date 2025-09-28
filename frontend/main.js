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

  // Start maximized
  mainWin.maximize();

  // Toggle fullscreen
  ipcMain.on("toggle-fullscreen", () => {
    if (mainWin) mainWin.setFullScreen(!mainWin.isFullScreen());
  });

  // Open module in the same window
  ipcMain.on("open-module", (event, modulePath) => {
    mainWin.loadFile(path.join(__dirname, modulePath, "views/index.html"));
  });

  // Exit app when ❌ Exit button clicked
  ipcMain.on("app-exit", () => {
    app.quit();
  });
}

app.whenReady().then(() => {
  createMainWindow();
  const menu = Menu.buildFromTemplate([]); // replace with your menuTemplate if needed
  Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
