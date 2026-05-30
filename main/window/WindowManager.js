const { BrowserWindow } = require('electron');
const path = require('path');

function createMainWindow(basePath) {
  const mainWindow = new BrowserWindow({
    title: 'Vyu',
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0e0e0e',
    autoHideMenuBar: true,
    icon: path.join(basePath, 'assets', 'Vyuicon.png'),
    webPreferences: {
      preload: path.join(basePath, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(basePath, 'renderer', 'index.html'));
  return mainWindow;
}

module.exports = { createMainWindow };
