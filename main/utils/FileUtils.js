const path = require('path');

function isSupportedExtension(ext) {
  return ['.pdf', '.cbz', '.cbr'].includes(ext.toLowerCase());
}

function isImageFile(fileName) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);
}

function getMimeByExt(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function sortAlphabetically(items, getKey) {
  return [...items].sort((a, b) =>
    getKey(a).localeCompare(getKey(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );
}

module.exports = {
  isSupportedExtension,
  isImageFile,
  getMimeByExt,
  sortAlphabetically
};
