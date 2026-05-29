const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mhq', {
  openComicFile: () => ipcRenderer.invoke('dialog:open-comic-file'),
  openComicDirectory: () => ipcRenderer.invoke('dialog:open-comic-directory'),
  scanLibraryDirectories: (directories) => ipcRenderer.invoke('library:scan-directories', directories),
  loadComic: (filePath) => ipcRenderer.invoke('comic:load', filePath),
  getPdfJsPaths: () => ipcRenderer.invoke('pdfjs:get-paths'),
  getComicCover: (filePath) => ipcRenderer.invoke('comic:get-cover', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
});
