const { app, BrowserWindow } = require('electron');
const { createMainWindow } = require('./main/window/WindowManager');
const { registerIpcHandlers } = require('./main/ipc/IpcHandlers');

registerIpcHandlers();

app.whenReady().then(() => {
  createMainWindow(__dirname);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(__dirname);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
