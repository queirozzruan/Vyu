import type { LibraryItem } from '../../shared/ipc';
import { readPreference, writePreference } from './preferencesRepository';
import type {
  AppState,
  LibraryFolderGroup,
  LibraryTheme,
  LibraryViewName,
  ReaderModeName,
  ReadingProgress
} from './types';

export const state: AppState = {
  title: '',
  kind: null,
  imagePages: [],
  imagePageCache: new Map(),
  imagePagePromises: new Map(),
  webtoonImageObserver: null,
  pdfDocument: null,
  pdfjsLib: null,
  currentFilePath: '',
  currentPageIndex: 0,
  totalPages: 0,
  rendering: false,
  pendingRender: false,
  pageVersion: 0,
  zoom: 1,
  fitMode: 'height',
  readerMode: 'paged',
  panX: 0,
  panY: 0,
  currentImageNaturalWidth: 0,
  currentImageNaturalHeight: 0,
  libraryDirectories: [],
  libraryItems: [],
  activeLibraryView: 'collection',
  activeCollectionDirectory: '',
  activeTheme: 'dark',
  readingProgress: {},
  recentItems: [],
  favoriteItems: [],
  seenItems: []
};

export const LIBRARY_VIEWS = {
  recent: {
    label: 'Vistos recentes',
    title: 'Vistos recentes',
    sectionTitle: 'Continuar leitura',
    description: 'Os arquivos que voc\u00ea abriu por \u00faltimo ficam sempre \u00e0 m\u00e3o.',
    emptyTitle: 'Nada visto ainda',
    emptyText: 'Abra uma HQ ou mang\u00e1 para montar sua fila recente.'
  },
  favorites: {
    label: 'Favoritos',
    title: 'Favoritos',
    sectionTitle: 'Marcados como favoritos',
    description: 'Guarde aqui as leituras que voc\u00ea quer encontrar r\u00e1pido.',
    emptyTitle: 'Nenhum favorito',
    emptyText: 'Use a estrela nos cards para destacar suas HQs preferidas.'
  },
  collection: {
    label: 'Cole\u00e7\u00e3o',
    title: 'Cole\u00e7\u00e3o',
    sectionTitle: 'Pastas da cole\u00e7\u00e3o',
    description: 'Sua biblioteca local agrupada por pastas, com as HQs e mang\u00e1s equivalentes em cada uma.',
    emptyTitle: 'Sua biblioteca est\u00e1 vazia',
    emptyText: 'Adicione uma pasta para visualizar capas e arquivos locais.'
  }
} as const;

const LIBRARY_THEMES: LibraryTheme[] = ['dark', 'light'];
export const READER_MODES = {
  paged: {
    label: 'P\u00e1gina',
    description: 'Leitura tradicional, uma p\u00e1gina por vez.'
  },
  webtoon: {
    label: 'Webtoon',
    description: 'Cap\u00edtulo cont\u00ednuo para leitura por rolagem.'
  }
} as const;

const MAX_RECENT_ITEMS = 24;

function normalizePath(filePath = ''): string {
  return filePath.replace(/\\/g, '/');
}

function getDirectoryFromPath(filePath = ''): string {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/') || '';
}

function getExtensionFromPath(filePath = ''): string {
  const fileName = normalizePath(filePath).split('/').pop() || '';
  const pieces = fileName.split('.');
  return pieces.length > 1 ? pieces.pop()?.toLowerCase() ?? '' : '';
}

function getTitleFromPath(filePath = ''): string {
  const fileName = normalizePath(filePath).split('/').pop() || 'Sem titulo';
  return fileName.replace(/\.[^/.]+$/, '');
}

function normalizeLibraryDirectories(directories: unknown): string[] {
  if (!Array.isArray(directories)) return [];

  return directories.reduce<string[]>((unique, directory: unknown) => {
    if (typeof directory !== 'string') return unique;

    const normalized = directory.trim();
    if (normalized && !unique.includes(normalized)) {
      unique.push(normalized);
    }

    return unique;
  }, []);
}

function normalizeReadingProgress(progress: unknown): Record<string, ReadingProgress> {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return {};

  return Object.entries(progress).reduce<Record<string, ReadingProgress>>((normalized, [filePath, value]) => {
    if (!filePath || !value || typeof value !== 'object') return normalized;

    const stored = value as Record<string, unknown>;

    const pageIndex = Number(stored.pageIndex);
    const totalPages = Number(stored.totalPages);
    const updatedAt = Number(stored.updatedAt);

    normalized[filePath] = {
      pageIndex: Number.isFinite(pageIndex) ? Math.max(0, Math.floor(pageIndex)) : 0,
      totalPages: Number.isFinite(totalPages) ? Math.max(0, Math.floor(totalPages)) : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
      title: typeof stored.title === 'string' && stored.title
        ? stored.title
        : getTitleFromPath(filePath)
    };

    return normalized;
  }, {});
}

function clampPageIndex(pageIndex: number, totalPages: number): number {
  const maxIndex = Math.max(0, Number(totalPages || 1) - 1);
  const normalizedIndex = Number.isFinite(Number(pageIndex)) ? Math.floor(Number(pageIndex)) : 0;
  return Math.min(Math.max(normalizedIndex, 0), maxIndex);
}

export function normalizeLibraryItem(item: Partial<LibraryItem> = {}): LibraryItem {
  return {
    filePath: item.filePath || '',
    title: item.title || getTitleFromPath(item.filePath),
    directory: item.directory || getDirectoryFromPath(item.filePath),
    extension: (item.extension || getExtensionFromPath(item.filePath)).toLowerCase(),
    lastOpenedAt: item.lastOpenedAt || null,
    favoritedAt: item.favoritedAt || null,
    seenAt: item.seenAt || null
  };
}

export function hydrateLibraryPreferences(): void {
  const savedView = readPreference('view', 'collection');
  const savedTheme = readPreference('theme', 'dark');
  const savedReaderMode = readPreference('readerMode', 'paged');
  state.activeLibraryView = savedView in LIBRARY_VIEWS ? savedView : 'collection';
  state.activeTheme = LIBRARY_THEMES.includes(savedTheme) ? savedTheme : 'dark';
  state.readerMode = savedReaderMode in READER_MODES ? savedReaderMode : 'paged';
  state.libraryDirectories = normalizeLibraryDirectories(readPreference('directories', [] as string[]));
  state.readingProgress = normalizeReadingProgress(
    readPreference('readingProgress', {} as Record<string, ReadingProgress>)
  );
  state.recentItems = readPreference('recent', [] as LibraryItem[]).map(normalizeLibraryItem);
  state.favoriteItems = readPreference('favorites', [] as LibraryItem[]).map(normalizeLibraryItem);
  state.seenItems = readPreference('seen', [] as LibraryItem[]).map(normalizeLibraryItem);
}

export function persistLibraryDirectories(directories: string[] = state.libraryDirectories): void {
  state.libraryDirectories = normalizeLibraryDirectories(directories);
  writePreference('directories', state.libraryDirectories);
}

export function addLibraryDirectory(directoryPath: string): void {
  persistLibraryDirectories([...state.libraryDirectories, directoryPath]);
}

export function setLibraryView(viewName: LibraryViewName): void {
  state.activeLibraryView = viewName;
  if (viewName !== 'collection') {
    state.activeCollectionDirectory = '';
  }
  writePreference('view', viewName);
}

export function setActiveCollectionDirectory(directory: string): void {
  state.activeCollectionDirectory = directory || '';
}

export function setLibraryTheme(themeName: LibraryTheme): void {
  if (!LIBRARY_THEMES.includes(themeName)) return;
  state.activeTheme = themeName;
  writePreference('theme', themeName);
}

export function toggleLibraryTheme(): LibraryTheme {
  const nextTheme = state.activeTheme === 'dark' ? 'light' : 'dark';
  setLibraryTheme(nextTheme);
  return nextTheme;
}

export function setReaderMode(modeName: ReaderModeName): void {
  state.readerMode = modeName;
  writePreference('readerMode', modeName);
}

export function getReadingProgress(filePath: string, totalPages: number | null = null): ReadingProgress | null {
  const progress = state.readingProgress[filePath];
  if (!progress) return null;

  return {
    ...progress,
    pageIndex: totalPages ? clampPageIndex(progress.pageIndex, totalPages) : progress.pageIndex
  };
}

export function getReadingProgressPercent(filePath: string): number {
  if (isSeen(filePath)) return 100;

  const progress = getReadingProgress(filePath);
  if (!progress || progress.totalPages <= 0) return 0;

  return Math.min(100, Math.max(0, ((progress.pageIndex + 1) / progress.totalPages) * 100));
}

export function rememberReadingProgress({
  filePath = state.currentFilePath,
  pageIndex = state.currentPageIndex,
  totalPages = state.totalPages,
  title = state.title
}: Partial<Pick<ReadingProgress, 'pageIndex' | 'totalPages' | 'title'>> & { filePath?: string } = {}): void {
  if (!filePath || !totalPages) return;

  const nextProgress = {
    pageIndex: clampPageIndex(pageIndex, totalPages),
    totalPages,
    updatedAt: Date.now(),
    title: title || getTitleFromPath(filePath)
  };

  state.readingProgress = {
    ...state.readingProgress,
    [filePath]: nextProgress
  };

  writePreference('readingProgress', state.readingProgress);
}

export function isFavorite(filePath: string): boolean {
  return state.favoriteItems.some((item) => item.filePath === filePath);
}

export function isSeen(filePath: string): boolean {
  return state.seenItems.some((item) => item.filePath === filePath);
}

export function toggleFavoriteItem(item: Partial<LibraryItem>): void {
  const normalized = normalizeLibraryItem(item);
  const existingIndex = state.favoriteItems.findIndex((favorite) => favorite.filePath === normalized.filePath);

  if (existingIndex >= 0) {
    state.favoriteItems.splice(existingIndex, 1);
  } else {
    state.favoriteItems.unshift({ ...normalized, favoritedAt: Date.now() });
  }

  writePreference('favorites', state.favoriteItems);
}

export function toggleSeenItem(item: Partial<LibraryItem>): void {
  const normalized = normalizeLibraryItem(item);
  const existingIndex = state.seenItems.findIndex((seen) => seen.filePath === normalized.filePath);

  if (existingIndex >= 0) {
    state.seenItems.splice(existingIndex, 1);
  } else {
    state.seenItems.unshift({ ...normalized, seenAt: Date.now() });
  }

  writePreference('seen', state.seenItems);
}

export function rememberRecentItem(item: Partial<LibraryItem>): void {
  const normalized = normalizeLibraryItem(item);
  const nextRecentItems = state.recentItems.filter((recent) => recent.filePath !== normalized.filePath);
  nextRecentItems.unshift({ ...normalized, lastOpenedAt: Date.now() });
  state.recentItems = nextRecentItems.slice(0, MAX_RECENT_ITEMS);
  writePreference('recent', state.recentItems);
}

export function reconcileLibraryCollections(items: LibraryItem[]): void {
  const byPath = new Map<string, LibraryItem>(
    items.map((item) => [item.filePath, normalizeLibraryItem(item)])
  );

  state.recentItems = state.recentItems.map((item) => {
    const current = byPath.get(item.filePath);
    return current ? { ...current, lastOpenedAt: item.lastOpenedAt, favoritedAt: item.favoritedAt } : item;
  });

  state.favoriteItems = state.favoriteItems.map((item) => {
    const current = byPath.get(item.filePath);
    return current ? { ...current, lastOpenedAt: item.lastOpenedAt, favoritedAt: item.favoritedAt } : item;
  });

  state.seenItems = state.seenItems.map((item) => {
    const current = byPath.get(item.filePath);
    return current ? { ...current, lastOpenedAt: item.lastOpenedAt, seenAt: item.seenAt } : item;
  });

  writePreference('recent', state.recentItems);
  writePreference('favorites', state.favoriteItems);
  writePreference('seen', state.seenItems);
}

export function getVisibleLibraryItems(): LibraryItem[] {
  if (state.activeLibraryView === 'recent') return state.recentItems;
  if (state.activeLibraryView === 'favorites') return state.favoriteItems;
  return state.libraryItems;
}

export function getLibraryFolderGroups(items: LibraryItem[] = state.libraryItems): LibraryFolderGroup[] {
  const groups = new Map<string, LibraryFolderGroup>();

  items.map(normalizeLibraryItem).forEach((item) => {
    const directory = item.directory || '';
    if (!groups.has(directory)) {
      const normalizedDirectory = normalizePath(directory);
      groups.set(directory, {
        id: directory || 'root',
        directory,
        name: normalizedDirectory.split('/').filter(Boolean).pop() || 'Arquivos locais',
        items: []
      });
    }

    groups.get(directory)?.items.push(item);
  });

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

hydrateLibraryPreferences();
