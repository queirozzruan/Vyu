import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import AdmZip from 'adm-zip';
import type { ComicPagePayload, ComicPageRef } from '../../shared/ipc';
import { getMimeByExt, isImageFile, sortAlphabetically } from '../utils/FileUtils';

const runtimeRequire = createRequire(__filename);
const MAX_CBR_CACHE_ITEMS = 2;

interface CbrArchiveCacheEntry {
  data: Buffer;
  size: number;
  mtimeMs: number;
}

interface CbrFileHeader {
  name: string;
  flags?: {
    directory?: boolean;
  };
}

type ExtractedBinary = ArrayBuffer | Uint8Array | number[];

interface CbrExtractedFile {
  fileHeader?: {
    name?: string;
  };
  extraction?: ExtractedBinary;
  extract?: [unknown, ExtractedBinary?];
}

interface CbrExtractor {
  getFileList: () => {
    fileHeaders?: CbrFileHeader[];
  } | null;
  extract: (options: { files: string[] }) => {
    files?: CbrExtractedFile[];
  } | null;
}

const cbrArchiveDataCache = new Map<string, CbrArchiveCacheEntry>();

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

function createImagePayload(fileName: string, imageBuffer: Buffer): ComicPagePayload {
  return {
    name: fileName,
    mime: getMimeByExt(fileName),
    data: toArrayBuffer(imageBuffer)
  };
}

function bufferFromExtracted(extracted: ExtractedBinary): Buffer {
  if (extracted instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(extracted));
  }

  return Buffer.from(extracted);
}

function getZipImageEntries(filePath: string) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  return sortAlphabetically(
    entries.filter((entry) => !entry.isDirectory && isImageFile(entry.entryName)),
    (entry) => entry.entryName
  );
}

function pageListFromEntries<T>(entries: T[], getName: (entry: T) => string): ComicPageRef[] {
  if (entries.length === 0) {
    throw new Error('Nenhuma imagem encontrada no arquivo.');
  }

  return entries.map((entry) => ({ name: getName(entry) }));
}

function touchCacheEntry<T>(cache: Map<string, T>, key: string, value: T): void {
  cache.delete(key);
  cache.set(key, value);
}

async function readCbrArchiveData(filePath: string): Promise<Buffer> {
  const stat = await fs.stat(filePath);
  const cached = cbrArchiveDataCache.get(filePath);

  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
    touchCacheEntry(cbrArchiveDataCache, filePath, cached);
    return cached.data;
  }

  const data = await fs.readFile(filePath);
  touchCacheEntry(cbrArchiveDataCache, filePath, {
    data,
    size: stat.size,
    mtimeMs: stat.mtimeMs
  });

  while (cbrArchiveDataCache.size > MAX_CBR_CACHE_ITEMS) {
    const oldestKey = cbrArchiveDataCache.keys().next().value;
    if (!oldestKey) break;
    cbrArchiveDataCache.delete(oldestKey);
  }

  return data;
}

async function createCbrExtractor(filePath: string): Promise<CbrExtractor> {
  const archiveData = await readCbrArchiveData(filePath);
  const { createExtractorFromData } = runtimeRequire('node-unrar-js') as {
    createExtractorFromData: (options: { data: Uint8Array }) => Promise<CbrExtractor>;
  };

  return createExtractorFromData({
    data: new Uint8Array(archiveData.buffer, archiveData.byteOffset, archiveData.byteLength)
  });
}

async function getCbrImageHeaders(filePath: string, extractor: CbrExtractor | null = null): Promise<CbrFileHeader[]> {
  const activeExtractor = extractor || await createCbrExtractor(filePath);
  const fileListResult = activeExtractor.getFileList();
  if (!fileListResult || !fileListResult.fileHeaders) {
    throw new Error('Falha ao ler lista de arquivos do CBR.');
  }

  return sortAlphabetically(
    fileListResult.fileHeaders.filter((header) => !header.flags?.directory && isImageFile(header.name)),
    (header) => header.name
  );
}

export async function extractCbzPageList(filePath: string): Promise<ComicPageRef[]> {
  return pageListFromEntries(getZipImageEntries(filePath), (entry) => entry.entryName);
}

export async function extractCbzPage(filePath: string, pageName: string): Promise<ComicPagePayload> {
  const imageEntries = getZipImageEntries(filePath);
  const targetEntry = imageEntries.find((entry) => entry.entryName === pageName);

  if (!targetEntry) {
    throw new Error('Pagina nao encontrada no arquivo CBZ.');
  }

  return createImagePayload(targetEntry.entryName, targetEntry.getData());
}

export async function extractCbrPageList(filePath: string): Promise<ComicPageRef[]> {
  const imageHeaders = await getCbrImageHeaders(filePath);
  return pageListFromEntries(imageHeaders, (header) => header.name);
}

export async function extractCbrPage(filePath: string, pageName: string): Promise<ComicPagePayload> {
  const extractor = await createCbrExtractor(filePath);
  const imageHeaders = await getCbrImageHeaders(filePath, extractor);
  const targetHeader = imageHeaders.find((header) => header.name === pageName);

  if (!targetHeader) {
    throw new Error('Pagina nao encontrada no arquivo CBR.');
  }

  const extractedResult = extractor.extract({ files: [targetHeader.name] });
  if (!extractedResult || !extractedResult.files) {
    throw new Error('Falha ao extrair pagina do CBR.');
  }

  for (const file of extractedResult.files) {
    if (file.fileHeader?.name === targetHeader.name) {
      const extracted = file.extraction ?? file.extract?.[1] ?? null;
      if (extracted) {
        return createImagePayload(targetHeader.name, bufferFromExtracted(extracted));
      }
    }
  }

  throw new Error('A pagina do CBR nao pode ser extraida.');
}

export async function extractFastCover(filePath: string, ext: string): Promise<string | null> {
  try {
    if (ext === '.cbz') {
      const imageEntries = getZipImageEntries(filePath);
      if (imageEntries.length === 0) return null;
      const firstEntry = imageEntries[0];
      const data = firstEntry.getData();
      const mime = getMimeByExt(firstEntry.entryName);
      return `data:${mime};base64,${data.toString('base64')}`;
    }

    if (ext === '.cbr') {
      const extractor = await createCbrExtractor(filePath);
      const imageHeaders = await getCbrImageHeaders(filePath, extractor);
      if (imageHeaders.length === 0) return null;

      const targetFile = imageHeaders[0].name;
      const extractedResult = extractor.extract({ files: [targetFile] });
      if (!extractedResult || !extractedResult.files) return null;

      for (const file of extractedResult.files) {
        if (file.fileHeader?.name === targetFile) {
          const extracted = file.extraction ?? file.extract?.[1] ?? null;
          if (extracted) {
            const imageBuffer = bufferFromExtracted(extracted);
            const mime = getMimeByExt(targetFile);
            return `data:${mime};base64,${imageBuffer.toString('base64')}`;
          }
        }
      }
      return null;
    }
  } catch (err) {
    console.error('Fast cover extraction failed for', filePath, err);
    return null;
  }
  return null;
}
