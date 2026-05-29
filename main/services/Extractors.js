const fs = require('fs/promises');
const AdmZip = require('adm-zip');
const {
  isImageFile,
  getMimeByExt,
  sortAlphabetically
} = require('../utils/FileUtils');

async function extractCbzPages(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const imageEntries = sortAlphabetically(
    entries.filter((entry) => !entry.isDirectory && isImageFile(entry.entryName)),
    (entry) => entry.entryName
  );

  if (imageEntries.length === 0) {
    throw new Error('Nenhuma imagem encontrada no arquivo CBZ.');
  }

  return imageEntries.map((entry) => {
    const fileName = entry.entryName;
    const data = entry.getData();
    const mime = getMimeByExt(fileName);
    return {
      name: fileName,
      src: `data:${mime};base64,${data.toString('base64')}`
    };
  });
}

async function extractCbrPages(filePath) {
  const { createExtractorFromData } = require('node-unrar-js');
  const archiveData = await fs.readFile(filePath);

  const extractor = await createExtractorFromData({
    data: Uint8Array.from(archiveData)
  });

  const fileListResult = extractor.getFileList();
  if (!fileListResult || !fileListResult.fileHeaders) {
    throw new Error('Falha ao ler lista de arquivos do CBR.');
  }

  const fileHeaders = fileListResult.fileHeaders ?? [];
  const imageHeaders = sortAlphabetically(
    fileHeaders.filter((header) => !header.flags?.directory && isImageFile(header.name)),
    (header) => header.name
  );

  if (imageHeaders.length === 0) {
    throw new Error('Nenhuma imagem encontrada no arquivo CBR.');
  }

  const targetFiles = imageHeaders.map((header) => header.name);
  const extractedResult = extractor.extract({ files: targetFiles });

  if (!extractedResult || !extractedResult.files) {
    throw new Error('Falha ao extrair imagens do CBR.');
  }

  const extractedFiles = extractedResult.files ?? [];
  const pages = [];

  for (const file of extractedFiles) {
    const fileName = file.fileHeader?.name ?? '';
    const extracted = file.extraction ?? file.extract?.[1] ?? null;

    if (!fileName || !extracted || !isImageFile(fileName)) {
      continue;
    }

    const imageBuffer = Buffer.from(extracted);
    const mime = getMimeByExt(fileName);

    pages.push({
      name: fileName,
      src: `data:${mime};base64,${imageBuffer.toString('base64')}`
    });
  }

  if (pages.length === 0) {
    throw new Error('As imagens do CBR nao puderam ser extraidas.');
  }

  return sortAlphabetically(pages, (page) => page.name);
}

async function extractFastCover(filePath, ext) {
  try {
    if (ext === '.cbz') {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      const imageEntries = sortAlphabetically(
        entries.filter((entry) => !entry.isDirectory && isImageFile(entry.entryName)),
        (entry) => entry.entryName
      );
      if (imageEntries.length === 0) return null;
      const firstEntry = imageEntries[0];
      const data = firstEntry.getData();
      const mime = getMimeByExt(firstEntry.entryName);
      return `data:${mime};base64,${data.toString('base64')}`;
    }

    if (ext === '.cbr') {
      const { createExtractorFromData } = require('node-unrar-js');
      const archiveData = await fs.readFile(filePath);
      const extractor = await createExtractorFromData({ data: Uint8Array.from(archiveData) });
      const fileListResult = extractor.getFileList();
      if (!fileListResult || !fileListResult.fileHeaders) return null;
      
      const imageHeaders = sortAlphabetically(
        fileListResult.fileHeaders.filter((header) => !header.flags?.directory && isImageFile(header.name)),
        (header) => header.name
      );
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
  extractCbzPages,
  extractCbrPages,
  extractFastCover
};
