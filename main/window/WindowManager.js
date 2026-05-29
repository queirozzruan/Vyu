const { BrowserWindow } = require('electron');
const path = require('path');

function createMainWindow(basePath) {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0e0e0e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(basePath, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(basePath, 'renderer', 'index.html'));
  return mainWindow;
}

module.exports = { createMainWindow };
