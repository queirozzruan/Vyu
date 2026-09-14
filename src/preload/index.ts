import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type MhqApi } from '../shared/ipc';

const mhqApi: MhqApi = {
  openComicFile: () => ipcRenderer.invoke(IPC_CHANNELS.openComicFile),
  openComicDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.openComicDirectory),
  scanLibraryDirectories: (directories) => ipcRenderer.invoke(IPC_CHANNELS.scanLibraryDirectories, directories),
  loadComic: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.loadComic, filePath),
  getComicPage: (filePath, pageName) => ipcRenderer.invoke(IPC_CHANNELS.getComicPage, filePath, pageName),
  getPdfJsPaths: () => ipcRenderer.invoke(IPC_CHANNELS.getPdfJsPaths),
  getComicCover: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.getComicCover, filePath),
  openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.openExternal, url)
};

contextBridge.exposeInMainWorld('mhq', mhqApi);
