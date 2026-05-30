import path from 'node:path';

export function isSupportedExtension(ext: string): boolean {
  return ['.pdf', '.cbz', '.cbr'].includes(ext.toLowerCase());
}

export function isImageFile(fileName: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);
}

export function getMimeByExt(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

export function sortAlphabetically<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...items].sort((a, b) =>
    getKey(a).localeCompare(getKey(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );
}
