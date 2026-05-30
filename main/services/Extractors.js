const fs = require('fs/promises');
const AdmZip = require('adm-zip');
const {
  isImageFile,
  getMimeByExt,
  sortAlphabetically
} = require('../utils/FileUtils');

const MAX_CBR_CACHE_ITEMS = 2;
const cbrArchiveDataCache = new Map();

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function createImagePayload(fileName, imageBuffer) {
  return {
    name: fileName,
    mime: getMimeByExt(fileName),
    data: toArrayBuffer(imageBuffer)
  };
}

function getZipImageEntries(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  return sortAlphabetically(
    entries.filter((entry) => !entry.isDirectory && isImageFile(entry.entryName)),
    (entry) => entry.entryName
  );
}

function pageListFromEntries(entries, getName) {
  if (entries.length === 0) {
    throw new Error('Nenhuma imagem encontrada no arquivo.');
  }

  return entries.map((entry) => ({ name: getName(entry) }));
}

function touchCacheEntry(cache, key, value) {
  cache.delete(key);
  cache.set(key, value);
}

async function readCbrArchiveData(filePath) {
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
    cbrArchiveDataCache.delete(cbrArchiveDataCache.keys().next().value);
  }

  return data;
}

async function createCbrExtractor(filePath) {
  const archiveData = await readCbrArchiveData(filePath);
  const { createExtractorFromData } = require('node-unrar-js');

  return createExtractorFromData({
    data: new Uint8Array(archiveData.buffer, archiveData.byteOffset, archiveData.byteLength)
  });
}

async function getCbrImageHeaders(filePath, extractor = null) {
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

async function extractCbzPageList(filePath) {
  return pageListFromEntries(getZipImageEntries(filePath), (entry) => entry.entryName);
}

async function extractCbzPage(filePath, pageName) {
  const imageEntries = getZipImageEntries(filePath);
  const targetEntry = imageEntries.find((entry) => entry.entryName === pageName);

  if (!targetEntry) {
    throw new Error('Pagina nao encontrada no arquivo CBZ.');
  }

  return createImagePayload(targetEntry.entryName, targetEntry.getData());
}

async function extractCbrPageList(filePath) {
  const imageHeaders = await getCbrImageHeaders(filePath);
  return pageListFromEntries(imageHeaders, (header) => header.name);
}

async function extractCbrPage(filePath, pageName) {
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
        return createImagePayload(targetHeader.name, Buffer.from(extracted));
      }
    }
  }

  throw new Error('A pagina do CBR nao pode ser extraida.');
}

async function extractFastCover(filePath, ext) {
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
            const imageBuffer = Buffer.from(extracted);
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

module.exports = {
  extractCbzPageList,
  extractCbrPageList,
  extractCbzPage,
  extractCbrPage,
  extractFastCover
};
