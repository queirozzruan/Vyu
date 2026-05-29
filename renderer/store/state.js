export const state = {
  title: '',
  kind: null,
  imagePages: [],
  pdfDocument: null,
  pdfjsLib: null,
  currentPageIndex: 0,
  totalPages: 0,
  rendering: false,
  pageVersion: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  libraryDirectories: [],
  libraryItems: [],
  activeLibraryView: 'collection',
  recentItems: [],
  favoriteItems: []
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
    sectionTitle: 'Todos os t\u00edtulos',
    description: 'Sua biblioteca local, limpa e organizada por pastas monitoradas.',
    emptyTitle: 'Sua biblioteca est\u00e1 vazia',
    emptyText: 'Adicione uma pasta para visualizar capas e arquivos locais.'
  }
};

const STORAGE_KEYS = {
  recent: 'mhqviewer:recent-items',
  favorites: 'mhqviewer:favorite-items',
  view: 'mhqviewer:active-library-view'
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

export function normalizeLibraryItem(item = {}) {
  return {
    filePath: item.filePath || '',
    title: item.title || getTitleFromPath(item.filePath),
    directory: item.directory || getDirectoryFromPath(item.filePath),
    extension: (item.extension || getExtensionFromPath(item.filePath)).toLowerCase(),
    lastOpenedAt: item.lastOpenedAt || null,
    favoritedAt: item.favoritedAt || null
  };
}

export function hydrateLibraryPreferences() {
  const savedView = readStorage(STORAGE_KEYS.view, 'collection');
  state.activeLibraryView = LIBRARY_VIEWS[savedView] ? savedView : 'collection';
  state.recentItems = readStorage(STORAGE_KEYS.recent, []).map(normalizeLibraryItem);
  state.favoriteItems = readStorage(STORAGE_KEYS.favorites, []).map(normalizeLibraryItem);
}

export function setLibraryView(viewName) {
  if (!LIBRARY_VIEWS[viewName]) return;
  state.activeLibraryView = viewName;
  writeStorage(STORAGE_KEYS.view, viewName);
}

export function isFavorite(filePath) {
  return state.favoriteItems.some((item) => item.filePath === filePath);
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

  writeStorage(STORAGE_KEYS.recent, state.recentItems);
  writeStorage(STORAGE_KEYS.favorites, state.favoriteItems);
}

export function getVisibleLibraryItems() {
  if (state.activeLibraryView === 'recent') return state.recentItems;
  if (state.activeLibraryView === 'favorites') return state.favoriteItems;
  return state.libraryItems;
}

hydrateLibraryPreferences();
