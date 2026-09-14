import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc/IpcHandlers';
import { createMainWindow } from './window/WindowManager';

registerIpcHandlers();

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
