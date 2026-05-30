export const IPC_CHANNELS = {
  openComicFile: 'dialog:open-comic-file',
  openComicDirectory: 'dialog:open-comic-directory',
  scanLibraryDirectories: 'library:scan-directories',
  loadComic: 'comic:load',
  getComicPage: 'comic:get-page',
  getPdfJsPaths: 'pdfjs:get-paths',
  getComicCover: 'comic:get-cover',
  openExternal: 'shell:open-external'
} as const;

export interface LibraryItem {
  filePath: string;
  fileName?: string;
  title: string;
  extension: string;
  directory: string;
  lastOpenedAt?: number | null;
  favoritedAt?: number | null;
  seenAt?: number | null;
}

export interface LibraryScanResult {
  directories: string[];
  items: LibraryItem[];
}

export interface ComicPageRef {
  name: string;
}

export interface ComicPagePayload {
  name: string;
  mime: string;
  data: ArrayBuffer;
}

export interface PdfComicLoadResult {
  kind: 'pdf';
  title: string;
  fileName: string;
  pdfBase64: string;
}

export interface ImageComicLoadResult {
  kind: 'images';
  title: string;
  fileName: string;
  pages: ComicPageRef[];
}

export type ComicLoadResult = PdfComicLoadResult | ImageComicLoadResult;

export interface PdfJsPaths {
  moduleUrl: string;
  workerUrl: string;
}

export interface MhqApi {
  openComicFile: () => Promise<string | null>;
  openComicDirectory: () => Promise<string | null>;
  scanLibraryDirectories: (directories: string[]) => Promise<LibraryScanResult>;
  loadComic: (filePath: string) => Promise<ComicLoadResult>;
  getComicPage: (filePath: string, pageName: string) => Promise<ComicPagePayload>;
  getPdfJsPaths: () => Promise<PdfJsPaths>;
  getComicCover: (filePath: string) => Promise<string | null>;
  openExternal: (url: string) => Promise<boolean>;
}
