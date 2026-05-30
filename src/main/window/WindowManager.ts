import { app, BrowserWindow } from 'electron';
import path from 'node:path';

export function createMainWindow(): BrowserWindow {
  const appRoot = app.getAppPath();

  const mainWindow = new BrowserWindow({
    title: 'Vyu',
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0e0e0e',
    autoHideMenuBar: true,
    icon: path.join(appRoot, 'assets', 'Vyuicon.png'),
    webPreferences: {
      preload: path.join(appRoot, 'out', 'preload', 'index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(appRoot, 'renderer', 'index.html'));
  return mainWindow;
}
