import { dialog, ipcMain, shell } from 'electron';
import * as fsSync from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  IPC_CHANNELS,
  type ComicLoadResult,
  type ComicPagePayload,
  type LibraryItem,
  type LibraryScanResult,
  type PdfJsPaths
} from '../../shared/ipc';
import { extractCbzPage, extractCbzPageList, extractCbrPage, extractCbrPageList, extractFastCover } from '../services/Extractors';
import { walkSupportedFiles } from '../services/Scanner';
import { isSupportedExtension, sortAlphabetically } from '../utils/FileUtils';

const runtimeRequire = createRequire(__filename);

function resolveRuntimeFile(filePath: string): string {
  const unpackedPath = filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  return fsSync.existsSync(unpackedPath) ? unpackedPath : filePath;
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.openComicFile, async (): Promise<string | null> => {
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

  ipcMain.handle(IPC_CHANNELS.openComicDirectory, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar pasta da biblioteca',
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.scanLibraryDirectories, async (_event, directoryPaths: unknown): Promise<LibraryScanResult> => {
    if (!Array.isArray(directoryPaths)) {
      throw new Error('Entrada invalida para scan de biblioteca.');
    }

    const normalizedDirectories: string[] = [];
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

    const filePaths: string[] = [];
    for (const directoryPath of normalizedDirectories) {
      await walkSupportedFiles(directoryPath, filePaths);
    }

    const items: LibraryItem[] = sortAlphabetically(filePaths, (filePath) => filePath).map((filePath) => {
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

  ipcMain.handle(IPC_CHANNELS.getPdfJsPaths, async (): Promise<PdfJsPaths> => {
    const modulePath = resolveRuntimeFile(runtimeRequire.resolve('pdfjs-dist/legacy/build/pdf.min.mjs'));
    const workerPath = resolveRuntimeFile(runtimeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'));

    return {
      moduleUrl: pathToFileURL(modulePath).href,
      workerUrl: pathToFileURL(workerPath).href
    };
  });

  ipcMain.handle(IPC_CHANNELS.loadComic, async (_event, filePath: unknown): Promise<ComicLoadResult> => {
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
      const pages = await extractCbzPageList(resolvedPath);
      return {
        kind: 'images',
        title: path.basename(resolvedPath, ext),
        fileName: path.basename(resolvedPath),
        pages
      };
    }

    const pages = await extractCbrPageList(resolvedPath);
    return {
      kind: 'images',
      title: path.basename(resolvedPath, ext),
      fileName: path.basename(resolvedPath),
      pages
    };
  });

  ipcMain.handle(IPC_CHANNELS.getComicPage, async (_event, filePath: unknown, pageName: unknown): Promise<ComicPagePayload> => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Caminho de arquivo invalido.');
    }

    if (typeof pageName !== 'string' || !pageName.trim()) {
      throw new Error('Pagina invalida.');
    }

    const resolvedPath = path.resolve(filePath);
    const ext = path.extname(resolvedPath).toLowerCase();

    if (ext === '.cbz') {
      return extractCbzPage(resolvedPath, pageName);
    }

    if (ext === '.cbr') {
      return extractCbrPage(resolvedPath, pageName);
    }

    throw new Error('Formato sem pagina de imagem sob demanda.');
  });

  ipcMain.handle(IPC_CHANNELS.getComicCover, async (_event, filePath: unknown): Promise<string | null> => {
    if (typeof filePath !== 'string' || !filePath.trim()) return null;
    const resolvedPath = path.resolve(filePath);
    const ext = path.extname(resolvedPath).toLowerCase();

    return extractFastCover(resolvedPath, ext);
  });

  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, url: unknown): Promise<boolean> => {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
      return false;
    }

    await shell.openExternal(url);
    return true;
  });
}
