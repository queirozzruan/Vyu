import type { ComicPageRef, LibraryItem } from '../../shared/ipc';

export type LibraryViewName = 'recent' | 'favorites' | 'collection';
export type LibraryTheme = 'dark' | 'light';
export type ReaderModeName = 'paged' | 'webtoon';
export type FitMode = 'height' | 'width';

export interface ReadingProgress {
  pageIndex: number;
  totalPages: number;
  updatedAt: number | null;
  title: string;
}

export interface RendererComicPage extends ComicPageRef {
  src?: string;
}

export interface LibraryFolderGroup {
  id: string;
  directory: string;
  name: string;
  items: LibraryItem[];
}

export interface AppState {
  title: string;
  kind: 'pdf' | 'images' | null;
  imagePages: RendererComicPage[];
  imagePageCache: Map<number, string>;
  imagePagePromises: Map<number, Promise<string | null>>;
  webtoonImageObserver: IntersectionObserver | null;
  pdfDocument: unknown;
  pdfjsLib: unknown;
  currentFilePath: string;
  currentPageIndex: number;
  totalPages: number;
  rendering: boolean;
  pendingRender: boolean;
  pageVersion: number;
  zoom: number;
  fitMode: FitMode;
  readerMode: ReaderModeName;
  panX: number;
  panY: number;
  libraryDirectories: string[];
  libraryItems: LibraryItem[];
  activeLibraryView: LibraryViewName;
  activeCollectionDirectory: string;
  activeTheme: LibraryTheme;
  readingProgress: Record<string, ReadingProgress>;
  recentItems: LibraryItem[];
  favoriteItems: LibraryItem[];
  seenItems: LibraryItem[];
}

export interface PreferenceSchema {
  directories: string[];
  recent: LibraryItem[];
  favorites: LibraryItem[];
  seen: LibraryItem[];
  view: LibraryViewName;
  theme: LibraryTheme;
  readerMode: ReaderModeName;
  readingProgress: Record<string, ReadingProgress>;
}
