export const state = {
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
};

const STORAGE_KEYS = {
  directories: 'vyu:library-directories',
  recent: 'vyu:recent-items',
  favorites: 'vyu:favorite-items',
  seen: 'vyu:seen-items',
  view: 'vyu:active-library-view',
  theme: 'vyu:theme',
  readerMode: 'vyu:reader-mode',
  readingProgress: 'vyu:reading-progress'
};

const LEGACY_STORAGE_KEYS = {
  directories: 'mhqviewer:library-directories',
  recent: 'mhqviewer:recent-items',
  favorites: 'mhqviewer:favorite-items',
  seen: 'mhqviewer:seen-items',
  view: 'mhqviewer:active-library-view',
  theme: 'mhqviewer:theme',
  readerMode: 'mhqviewer:reader-mode',
  readingProgress: 'mhqviewer:reading-progress'
};

const LIBRARY_THEMES = ['dark', 'light'];
export const READER_MODES = {
  paged: {
    label: 'P\u00e1gina',
    description: 'Leitura tradicional, uma p\u00e1gina por vez.'
  },
  webtoon: {
    label: 'Webtoon',
    description: 'Cap\u00edtulo cont\u00ednuo para leitura por rolagem.'
  }
};

const MAX_RECENT_ITEMS = 24;

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readPreference(name, fallback) {
  const value = readStorage(STORAGE_KEYS[name], null);
  if (value !== null) return value;

  return readStorage(LEGACY_STORAGE_KEYS[name], fallback);
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in constrained environments.
  }
}

function normalizePath(filePath = '') {
  return filePath.replace(/\\/g, '/');
}

function getDirectoryFromPath(filePath = '') {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/') || '';
}

function getExtensionFromPath(filePath = '') {
  const fileName = normalizePath(filePath).split('/').pop() || '';
  const pieces = fileName.split('.');
  return pieces.length > 1 ? pieces.pop().toLowerCase() : '';
}

function getTitleFromPath(filePath = '') {
  const fileName = normalizePath(filePath).split('/').pop() || 'Sem titulo';
  return fileName.replace(/\.[^/.]+$/, '');
}

function normalizeLibraryDirectories(directories = []) {
  if (!Array.isArray(directories)) return [];

  return directories.reduce((unique, directory) => {
    if (typeof directory !== 'string') return unique;

    const normalized = directory.trim();
    if (normalized && !unique.includes(normalized)) {
      unique.push(normalized);
    }

    return unique;
  }, []);
}

function normalizeReadingProgress(progress = {}) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return {};

  return Object.entries(progress).reduce((normalized, [filePath, value]) => {
    if (!filePath || !value || typeof value !== 'object') return normalized;

    const pageIndex = Number(value.pageIndex);
    const totalPages = Number(value.totalPages);
    const updatedAt = Number(value.updatedAt);

    normalized[filePath] = {
      pageIndex: Number.isFinite(pageIndex) ? Math.max(0, Math.floor(pageIndex)) : 0,
      totalPages: Number.isFinite(totalPages) ? Math.max(0, Math.floor(totalPages)) : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
      title: value.title || getTitleFromPath(filePath)
    };

    return normalized;
  }, {});
}

function clampPageIndex(pageIndex, totalPages) {
  const maxIndex = Math.max(0, Number(totalPages || 1) - 1);
  const normalizedIndex = Number.isFinite(Number(pageIndex)) ? Math.floor(Number(pageIndex)) : 0;
  return Math.min(Math.max(normalizedIndex, 0), maxIndex);
}

export function normalizeLibraryItem(item = {}) {
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

export function hydrateLibraryPreferences() {
  const savedView = readPreference('view', 'collection');
  const savedTheme = readPreference('theme', 'dark');
  const savedReaderMode = readPreference('readerMode', 'paged');
  state.activeLibraryView = LIBRARY_VIEWS[savedView] ? savedView : 'collection';
  state.activeTheme = LIBRARY_THEMES.includes(savedTheme) ? savedTheme : 'dark';
  state.readerMode = READER_MODES[savedReaderMode] ? savedReaderMode : 'paged';
  state.libraryDirectories = normalizeLibraryDirectories(readPreference('directories', []));
  state.readingProgress = normalizeReadingProgress(readPreference('readingProgress', {}));
  state.recentItems = readPreference('recent', []).map(normalizeLibraryItem);
  state.favoriteItems = readPreference('favorites', []).map(normalizeLibraryItem);
  state.seenItems = readPreference('seen', []).map(normalizeLibraryItem);
}

export function persistLibraryDirectories(directories = state.libraryDirectories) {
  state.libraryDirectories = normalizeLibraryDirectories(directories);
  writeStorage(STORAGE_KEYS.directories, state.libraryDirectories);
}

export function addLibraryDirectory(directoryPath) {
  persistLibraryDirectories([...state.libraryDirectories, directoryPath]);
}

export function setLibraryView(viewName) {
  if (!LIBRARY_VIEWS[viewName]) return;
  state.activeLibraryView = viewName;
  if (viewName !== 'collection') {
    state.activeCollectionDirectory = '';
  }
  writeStorage(STORAGE_KEYS.view, viewName);
}

export function setActiveCollectionDirectory(directory) {
  state.activeCollectionDirectory = directory || '';
}

export function setLibraryTheme(themeName) {
  if (!LIBRARY_THEMES.includes(themeName)) return;
  state.activeTheme = themeName;
  writeStorage(STORAGE_KEYS.theme, themeName);
}

export function toggleLibraryTheme() {
  const nextTheme = state.activeTheme === 'dark' ? 'light' : 'dark';
  setLibraryTheme(nextTheme);
  return nextTheme;
}

export function setReaderMode(modeName) {
  if (!READER_MODES[modeName]) return;
  state.readerMode = modeName;
  writeStorage(STORAGE_KEYS.readerMode, modeName);
}

export function getReadingProgress(filePath, totalPages = null) {
  const progress = state.readingProgress[filePath];
  if (!progress) return null;

  return {
    ...progress,
    pageIndex: totalPages ? clampPageIndex(progress.pageIndex, totalPages) : progress.pageIndex
  };
}

export function getReadingProgressPercent(filePath) {
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
} = {}) {
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

  writeStorage(STORAGE_KEYS.readingProgress, state.readingProgress);
}

export function isFavorite(filePath) {
  return state.favoriteItems.some((item) => item.filePath === filePath);
}

export function isSeen(filePath) {
  return state.seenItems.some((item) => item.filePath === filePath);
}

export function toggleFavoriteItem(item) {
  const normalized = normalizeLibraryItem(item);
  const existingIndex = state.favoriteItems.findIndex((favorite) => favorite.filePath === normalized.filePath);

  if (existingIndex >= 0) {
    state.favoriteItems.splice(existingIndex, 1);
  } else {
    state.favoriteItems.unshift({ ...normalized, favoritedAt: Date.now() });
  }

  writeStorage(STORAGE_KEYS.favorites, state.favoriteItems);
}

export function toggleSeenItem(item) {
  const normalized = normalizeLibraryItem(item);
  const existingIndex = state.seenItems.findIndex((seen) => seen.filePath === normalized.filePath);

  if (existingIndex >= 0) {
    state.seenItems.splice(existingIndex, 1);
  } else {
    state.seenItems.unshift({ ...normalized, seenAt: Date.now() });
  }

  writeStorage(STORAGE_KEYS.seen, state.seenItems);
}

export function rememberRecentItem(item) {
  const normalized = normalizeLibraryItem(item);
  const nextRecentItems = state.recentItems.filter((recent) => recent.filePath !== normalized.filePath);
  nextRecentItems.unshift({ ...normalized, lastOpenedAt: Date.now() });
  state.recentItems = nextRecentItems.slice(0, MAX_RECENT_ITEMS);
  writeStorage(STORAGE_KEYS.recent, state.recentItems);
}

export function reconcileLibraryCollections(items) {
  const byPath = new Map(items.map((item) => [item.filePath, normalizeLibraryItem(item)]));

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

  writeStorage(STORAGE_KEYS.recent, state.recentItems);
  writeStorage(STORAGE_KEYS.favorites, state.favoriteItems);
  writeStorage(STORAGE_KEYS.seen, state.seenItems);
}

export function getVisibleLibraryItems() {
  if (state.activeLibraryView === 'recent') return state.recentItems;
  if (state.activeLibraryView === 'favorites') return state.favoriteItems;
  return state.libraryItems;
}

export function getLibraryFolderGroups(items = state.libraryItems) {
  const groups = new Map();

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

    groups.get(directory).items.push(item);
  });

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

hydrateLibraryPreferences();
