const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');

const { walkSupportedFiles } = require('../services/Scanner');
const { extractCbzPages, extractCbrPages, extractFastCover } = require('../services/Extractors');
const { isSupportedExtension, sortAlphabetically } = require('../utils/FileUtils');

function registerIpcHandlers() {
  ipcMain.handle('dialog:open-comic-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Abrir HQ / Manga',
      properties: ['openFile'],
      filters: [
        { name: 'HQ e Manga', extensions: ['pdf', 'cbz', 'cbr'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('dialog:open-comic-directory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar pasta da biblioteca',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('library:scan-directories', async (_event, directoryPaths) => {
    if (!Array.isArray(directoryPaths)) {
      throw new Error('Entrada invalida para scan de biblioteca.');
    }

    const normalizedDirectories = [];
    for (const dir of directoryPaths) {
      if (typeof dir !== 'string' || !dir.trim()) {
        continue;
      }

      const resolved = path.resolve(dir);
      const stat = await fs.stat(resolved).catch(() => null);
      if (stat && stat.isDirectory() && !normalizedDirectories.includes(resolved)) {
        normalizedDirectories.push(resolved);
      }
    }

    const filePaths = [];
    for (const directoryPath of normalizedDirectories) {
      await walkSupportedFiles(directoryPath, filePaths);
    }

    const items = sortAlphabetically(filePaths, (filePath) => filePath).map((filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      return {
        filePath,
        fileName: path.basename(filePath),
        title: path.basename(filePath, ext),
        extension: ext.slice(1),
        directory: path.dirname(filePath)
      };
    });

    return {
      directories: normalizedDirectories,
      items
    };
  });

  ipcMain.handle('pdfjs:get-paths', async () => {
    const modulePath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

    return {
      moduleUrl: pathToFileURL(modulePath).href,
      workerUrl: pathToFileURL(workerPath).href
    };
  });

  ipcMain.handle('comic:load', async (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Caminho de arquivo invalido.');
    }

    const resolvedPath = path.resolve(filePath);
    const ext = path.extname(resolvedPath).toLowerCase();

    if (!isSupportedExtension(ext)) {
      throw new Error('Formato nao suportado. Use .pdf, .cbz ou .cbr');
    }

    if (ext === '.pdf') {
      const buffer = await fs.readFile(resolvedPath);
      return {
        kind: 'pdf',
        title: path.basename(resolvedPath, ext),
        fileName: path.basename(resolvedPath),
        pdfBase64: buffer.toString('base64')
      };
    }

    if (ext === '.cbz') {
      const pages = await extractCbzPages(resolvedPath);
      return {
        kind: 'images',
        title: path.basename(resolvedPath, ext),
        fileName: path.basename(resolvedPath),
        pages
      };
    }

    const pages = await extractCbrPages(resolvedPath);
    return {
      kind: 'images',
      title: path.basename(resolvedPath, ext),
      fileName: path.basename(resolvedPath),
      pages
    };
  });

  ipcMain.handle('comic:get-cover', async (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath.trim()) return null;
    const resolvedPath = path.resolve(filePath);
    const ext = path.extname(resolvedPath).toLowerCase();

    return await extractFastCover(resolvedPath, ext);
  });

  ipcMain.handle('shell:open-external', async (_event, url) => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
      return false;
    }

    await shell.openExternal(url);
    return true;
  });
}

module.exports = { registerIpcHandlers };
