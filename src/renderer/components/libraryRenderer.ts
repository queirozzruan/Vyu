import {
  getLibraryFolderGroups,
  getReadingProgressPercent,
  getVisibleLibraryItems,
  isFavorite,
  isSeen,
  LIBRARY_VIEWS,
  setActiveCollectionDirectory,
  state,
  toggleFavoriteItem,
  toggleSeenItem
} from '../store/state.js';
import { els } from '../utils/dom.js';
import type { LibraryItem } from '../../shared/ipc';
import type { ComicOpenHandler, LibraryFolderGroup } from '../store/types';
import type { PdfJsModule } from '../types/pdfjs';

interface CoverLoadTask {
  filePath: string;
  imgEl: HTMLImageElement;
}

interface CoverActionOptions {
  className: string;
  iconName: string;
  active: boolean;
  title: string;
  onClick: () => void;
}

const coverPreviewCache = new Map<string, Promise<string | null>>();
const queuedCoverLoads: CoverLoadTask[] = [];
const PDF_PREVIEW_MAX_WIDTH = 220;
const PDF_PREVIEW_MAX_HEIGHT = 330;
const COVER_PREVIEW_MAX_WIDTH = 220;
const COVER_PREVIEW_MAX_HEIGHT = 330;
const COVER_PREVIEW_QUALITY = 0.68;
const MAX_ACTIVE_COVER_LOADS = 2;
const MAX_COVER_CACHE_ITEMS = 80;
const COVER_PREVIEW_STORAGE_KEY = 'vyu:cover-preview-cache:v1';
const MAX_PERSISTED_COVER_ITEMS = 80;
const MAX_PERSISTED_COVER_BYTES = 160000;

let activeCoverLoads = 0;
let coverObserver: IntersectionObserver | null = null;
let persistedCoverWriteScheduled = false;

function readPersistedCoverCache(): Map<string, string> {
  try {
    const rawCache = window.localStorage.getItem(COVER_PREVIEW_STORAGE_KEY);
    const entries: unknown = rawCache ? JSON.parse(rawCache) : [];
    if (!Array.isArray(entries)) return new Map();

    const validEntries = entries.filter((entry): entry is [string, string] => (
      Array.isArray(entry) &&
      typeof entry[0] === 'string' &&
      typeof entry[1] === 'string' &&
      entry[1].startsWith('data:image/')
    ));
    return new Map(validEntries);
  } catch {
    return new Map();
  }
}

const persistedCoverCache = readPersistedCoverCache();

function trimMap<K, V>(map: Map<K, V>, maxSize: number): void {
  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) return;
    map.delete(oldestKey);
  }
}

function schedulePersistedCoverWrite(): void {
  if (persistedCoverWriteScheduled) return;

  persistedCoverWriteScheduled = true;
  requestCoverIdleCallback(() => {
    persistedCoverWriteScheduled = false;
    trimMap(persistedCoverCache, MAX_PERSISTED_COVER_ITEMS);

    try {
      window.localStorage.setItem(COVER_PREVIEW_STORAGE_KEY, JSON.stringify(Array.from(persistedCoverCache.entries())));
    } catch {
      trimMap(persistedCoverCache, Math.floor(MAX_PERSISTED_COVER_ITEMS / 2));
      try {
        window.localStorage.setItem(COVER_PREVIEW_STORAGE_KEY, JSON.stringify(Array.from(persistedCoverCache.entries())));
      } catch {
        // Ignore cache persistence failures; covers can still be regenerated.
      }
    }
  });
}

function getPersistedCoverPreview(filePath: string): string | null {
  const preview = persistedCoverCache.get(filePath);
  if (!preview) return null;

  persistedCoverCache.delete(filePath);
  persistedCoverCache.set(filePath, preview);
  schedulePersistedCoverWrite();
  return preview;
}

function rememberPersistedCoverPreview(filePath: string, preview: string | null): void {
  if (!preview?.startsWith('data:image/') || preview.length > MAX_PERSISTED_COVER_BYTES) return;

  persistedCoverCache.delete(filePath);
  persistedCoverCache.set(filePath, preview);
  trimMap(persistedCoverCache, MAX_PERSISTED_COVER_ITEMS);
  schedulePersistedCoverWrite();
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

async function ensurePdfJs(): Promise<PdfJsModule> {
  if (state.pdfjsLib) return state.pdfjsLib;

  const paths = await window.mhq.getPdfJsPaths();
  const pdfjsLib = await import(paths.moduleUrl) as unknown as PdfJsModule;
  pdfjsLib.GlobalWorkerOptions.workerSrc = paths.workerUrl;
  state.pdfjsLib = pdfjsLib;

  return pdfjsLib;
}

async function renderPdfFirstPagePreview(filePath: string): Promise<string | null> {
  const result = await window.mhq.loadComic(filePath);
  if (result.kind !== 'pdf' || !result.pdfBase64) return null;

  const pdfjsLib = await ensurePdfJs();
  const pdfData = base64ToUint8Array(result.pdfBase64);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;

  try {
    const page = await pdfDocument.getPage(1);
    const viewportAt1x = page.getViewport({ scale: 1 });
    const fitScale = Math.min(
      PDF_PREVIEW_MAX_WIDTH / viewportAt1x.width,
      PDF_PREVIEW_MAX_HEIGHT / viewportAt1x.height
    );
    const viewport = page.getViewport({ scale: Math.max(fitScale * 1.4, 0.2) });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Falha ao preparar preview da capa.');

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    return canvas.toDataURL('image/jpeg', COVER_PREVIEW_QUALITY);
  } finally {
    if (pdfDocument?.destroy) await pdfDocument.destroy();
  }
}

function waitForPreviewImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao carregar preview da capa.'));
    image.src = src;
  });
}

async function compressCoverPreview(preview: string | null): Promise<string | null> {
  if (!preview?.startsWith('data:image/')) return preview;

  const image = await waitForPreviewImage(preview);
  if (!image.naturalWidth || !image.naturalHeight) return preview;

  const scale = Math.min(
    COVER_PREVIEW_MAX_WIDTH / image.naturalWidth,
    COVER_PREVIEW_MAX_HEIGHT / image.naturalHeight,
    1
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Falha ao preparar cache da capa.');

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', COVER_PREVIEW_QUALITY);
}

async function createCoverPreview(filePath: string): Promise<string | null> {
  const ext = filePath.toLowerCase().split('.').pop();
  const preview = ext === 'pdf'
    ? await renderPdfFirstPagePreview(filePath)
    : await window.mhq.getComicCover(filePath);

  return compressCoverPreview(preview);
}

function getCoverPreview(filePath: string): Promise<string | null> {
  const cachedPreview = coverPreviewCache.get(filePath);
  if (cachedPreview) {
    coverPreviewCache.delete(filePath);
    coverPreviewCache.set(filePath, cachedPreview);
    return cachedPreview;
  }

  const persistedPreview = getPersistedCoverPreview(filePath);
  if (persistedPreview) {
    const previewPromise = Promise.resolve(persistedPreview);
    coverPreviewCache.set(filePath, previewPromise);
    return previewPromise;
  }

  while (coverPreviewCache.size >= MAX_COVER_CACHE_ITEMS) {
    const oldestKey = coverPreviewCache.keys().next().value;
    if (oldestKey === undefined) break;
    coverPreviewCache.delete(oldestKey);
  }

  const previewPromise = createCoverPreview(filePath)
    .then((preview) => {
      rememberPersistedCoverPreview(filePath, preview);
      return preview;
    })
    .catch((err) => {
      coverPreviewCache.delete(filePath);
      throw err;
    });

  coverPreviewCache.set(filePath, previewPromise);
  return previewPromise;
}

function requestCoverIdleCallback(callback: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: 700 });
    return;
  }

  globalThis.setTimeout(callback, 16);
}

async function loadAndDisplayCover(filePath: string, imgEl: HTMLImageElement): Promise<void> {
  if (!filePath || !imgEl.isConnected) return;

  try {
    const preview = await getCoverPreview(filePath);
    if (preview && imgEl.isConnected) {
      imgEl.src = preview;
      imgEl.classList.add('is-loaded');
    }
  } catch (err) {
    console.error('Error fetching cover for', filePath, err);
  }
}

function drainCoverQueue(): void {
  while (activeCoverLoads < MAX_ACTIVE_COVER_LOADS && queuedCoverLoads.length > 0) {
    const task = queuedCoverLoads.shift();
    if (!task) return;

    if (!task.imgEl.isConnected) {
      continue;
    }

    activeCoverLoads += 1;
    loadAndDisplayCover(task.filePath, task.imgEl).finally(() => {
      activeCoverLoads -= 1;
      requestCoverIdleCallback(drainCoverQueue);
    });
  }
}

function enqueueCoverLoad(filePath: string, imgEl: HTMLImageElement): void {
  if (!filePath || !imgEl.isConnected) return;

  queuedCoverLoads.push({ filePath, imgEl });
  requestCoverIdleCallback(drainCoverQueue);
}

function getCoverObserver(): IntersectionObserver | null {
  if (!('IntersectionObserver' in window)) return null;

  if (!coverObserver) {
    coverObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const imgEl = entry.target as HTMLImageElement;
        coverObserver?.unobserve(imgEl);
        enqueueCoverLoad(imgEl.dataset.coverPath || '', imgEl);
      });
    }, {
      root: null,
      rootMargin: '420px 0px'
    });
  }

  return coverObserver;
}

export function fetchAndDisplayCover(filePath: string, imgEl: HTMLImageElement): void {
  imgEl.dataset.coverPath = filePath;

  const observer = getCoverObserver();
  if (!observer) {
    enqueueCoverLoad(filePath, imgEl);
    return;
  }

  observer.observe(imgEl);
}

function formatDirectory(item: LibraryItem): string {
  if (!item.directory) return 'Arquivo local';
  return item.directory.replace(/\\/g, '/').split('/').pop() || 'Arquivo local';
}

function formatRecentDate(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atr\u00e1s`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function pluralizeTitles(count: number): string {
  return `${count} ${count === 1 ? 't\u00edtulo' : 't\u00edtulos'}`;
}

function pluralizeFolders(count: number): string {
  return `${count} ${count === 1 ? 'pasta' : 'pastas'}`;
}

function formatFolderPath(directory: string): string {
  return directory || 'Arquivos locais';
}

function renderLibraryHeader(metaText: string): void {
  const currentView = LIBRARY_VIEWS[state.activeLibraryView];

  if (els.libraryViewTitle) els.libraryViewTitle.textContent = currentView.title;
  if (els.libraryViewDescription) els.libraryViewDescription.textContent = currentView.description;
  if (els.librarySectionTitle) els.librarySectionTitle.textContent = currentView.sectionTitle;
  els.libraryMeta.textContent = metaText;

  if (!els.libraryViewTabs) return;

  els.libraryViewTabs.querySelectorAll<HTMLElement>('[data-library-view]').forEach((tab) => {
    const isActive = tab.dataset.libraryView === state.activeLibraryView;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
}

function renderEmptyState(): void {
  const currentView = LIBRARY_VIEWS[state.activeLibraryView];
  els.libraryEmpty.innerHTML = '';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'empty-icon';

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.textContent = state.activeLibraryView === 'favorites'
    ? 'star'
    : state.activeLibraryView === 'recent'
      ? 'history'
      : 'auto_stories';

  const title = document.createElement('h4');
  title.textContent = currentView.emptyTitle;

  const text = document.createElement('p');
  text.textContent = currentView.emptyText;

  iconWrap.appendChild(icon);
  els.libraryEmpty.appendChild(iconWrap);
  els.libraryEmpty.appendChild(title);
  els.libraryEmpty.appendChild(text);
}

function createCoverActionButton({
  className,
  iconName,
  active,
  title,
  onClick
}: CoverActionOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = `cover-action-btn ${className}${active ? ' is-active' : ''}`;
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-pressed', String(active));
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.textContent = iconName;

  button.appendChild(icon);
  return button;
}

function createComicCard(
  item: LibraryItem,
  onItemClick: ComicOpenHandler,
  index: number,
  { compact = false }: { compact?: boolean } = {}
): HTMLDivElement {
  const card = document.createElement('div');
  const seen = isSeen(item.filePath);
  card.className = `library-card${compact ? ' is-compact' : ''}${seen ? ' is-seen' : ''}`;
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;
  card.addEventListener('click', () => onItemClick(item.filePath));
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onItemClick(item.filePath);
  });

  const coverWrapper = document.createElement('div');
  coverWrapper.className = 'cover-frame';

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined cover-placeholder';
  icon.textContent = 'image';

  const imgEl = document.createElement('img');
  imgEl.className = 'comic-cover';
  imgEl.loading = 'lazy';
  imgEl.decoding = 'async';
  imgEl.alt = `Preview de ${item.title}`;

  const favorite = isFavorite(item.filePath);
  const actions = document.createElement('div');
  actions.className = 'cover-actions';

  const favoriteButton = createCoverActionButton({
    className: 'favorite-btn',
    iconName: 'star',
    active: favorite,
    title: favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos',
    onClick: () => {
      toggleFavoriteItem(item);
      renderLibraryItems(onItemClick);
    }
  });

  const seenButton = createCoverActionButton({
    className: 'seen-btn',
    iconName: 'visibility',
    active: seen,
    title: seen ? 'Remover dos vistos' : 'Marcar como visto',
    onClick: () => {
      toggleSeenItem(item);
      renderLibraryItems(onItemClick);
    }
  });

  const overlay = document.createElement('div');
  overlay.className = 'cover-accent';

  const progress = document.createElement('div');
  progress.className = 'cover-accent-fill';
  progress.style.width = `${getReadingProgressPercent(item.filePath)}%`;

  actions.appendChild(favoriteButton);
  actions.appendChild(seenButton);
  overlay.appendChild(progress);
  coverWrapper.appendChild(icon);
  coverWrapper.appendChild(imgEl);
  coverWrapper.appendChild(actions);
  coverWrapper.appendChild(overlay);

  const titleEl = document.createElement('h4');
  titleEl.className = 'card-title';
  titleEl.title = item.title;
  titleEl.textContent = item.title;

  const subEl = document.createElement('p');
  subEl.className = 'card-meta';

  const cleanDir = formatDirectory(item);
  const recentDate = state.activeLibraryView === 'recent' ? formatRecentDate(item.lastOpenedAt) : null;
  subEl.textContent = compact
    ? item.extension.toUpperCase()
    : recentDate
      ? `${item.extension.toUpperCase()} - ${cleanDir} - ${recentDate}`
      : `${item.extension.toUpperCase()} - ${cleanDir}`;

  card.appendChild(coverWrapper);
  card.appendChild(titleEl);
  card.appendChild(subEl);

  fetchAndDisplayCover(item.filePath, imgEl);

  return card;
}

function createFolderCard(
  group: LibraryFolderGroup,
  index: number,
  onItemClick: ComicOpenHandler
): HTMLButtonElement {
  const card = document.createElement('button');
  card.className = 'folder-card';
  card.type = 'button';
  card.title = formatFolderPath(group.directory);
  card.style.animationDelay = `${Math.min(index * 0.04, 0.4)}s`;
  card.addEventListener('click', () => {
    setActiveCollectionDirectory(group.directory);
    renderLibraryItems(onItemClick);
  });

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined folder-card-icon';
  icon.textContent = 'folder';

  const copy = document.createElement('span');
  copy.className = 'folder-card-copy';

  const title = document.createElement('strong');
  title.textContent = group.name;

  const meta = document.createElement('span');
  meta.textContent = pluralizeTitles(group.items.length);

  const path = document.createElement('small');
  path.textContent = formatFolderPath(group.directory);

  const arrow = document.createElement('span');
  arrow.className = 'material-symbols-outlined folder-card-arrow';
  arrow.textContent = 'chevron_right';

  copy.appendChild(title);
  copy.appendChild(meta);
  copy.appendChild(path);
  card.appendChild(icon);
  card.appendChild(copy);
  card.appendChild(arrow);

  return card;
}

function renderFolderCards(groups: LibraryFolderGroup[], onItemClick: ComicOpenHandler): void {
  groups.forEach((group, index) => {
    els.libraryGrid.appendChild(createFolderCard(group, index, onItemClick));
  });
}

function renderFolderDetail(group: LibraryFolderGroup, onItemClick: ComicOpenHandler): void {
  if (els.libraryViewTitle) els.libraryViewTitle.textContent = group.name;
  if (els.libraryViewDescription) els.libraryViewDescription.textContent = formatFolderPath(group.directory);
  if (els.librarySectionTitle) els.librarySectionTitle.textContent = 'Conteúdo da pasta';

  const top = document.createElement('div');
  top.className = 'folder-detail-top';

  const backButton = document.createElement('button');
  backButton.className = 'folder-back-btn';
  backButton.type = 'button';
  backButton.addEventListener('click', () => {
    setActiveCollectionDirectory('');
    renderLibraryItems(onItemClick);
  });

  const backIcon = document.createElement('span');
  backIcon.className = 'material-symbols-outlined';
  backIcon.textContent = 'arrow_back';

  const backLabel = document.createElement('span');
  backLabel.textContent = 'Pastas';

  backButton.appendChild(backIcon);
  backButton.appendChild(backLabel);
  top.appendChild(backButton);
  els.libraryGrid.appendChild(top);

  group.items.forEach((item, itemIndex) => {
    els.libraryGrid.appendChild(createComicCard(item, onItemClick, itemIndex));
  });
}

export function renderLibraryItems(onItemClick: ComicOpenHandler): void {
  els.libraryGrid.innerHTML = '';

  if (state.activeLibraryView === 'collection') {
    const groups = getLibraryFolderGroups();
    const totalItems = state.libraryItems.length;
    const activeGroup = state.activeCollectionDirectory
      ? groups.find((group) => group.directory === state.activeCollectionDirectory)
      : null;

    if (state.activeCollectionDirectory && !activeGroup) {
      setActiveCollectionDirectory('');
    }

    renderLibraryHeader(`${pluralizeFolders(groups.length)} - ${pluralizeTitles(totalItems)}`);
    els.libraryGrid.className = activeGroup ? 'library-grid folder-detail-grid' : 'folder-browser-grid';

    if (groups.length === 0) {
      els.libraryEmpty.classList.add('is-visible');
      renderEmptyState();
      return;
    }

    els.libraryEmpty.classList.remove('is-visible');
    if (activeGroup) {
      renderLibraryHeader(pluralizeTitles(activeGroup.items.length));
      renderFolderDetail(activeGroup, onItemClick);
    } else {
      renderFolderCards(groups, onItemClick);
    }
    return;
  }

  const items = getVisibleLibraryItems();
  renderLibraryHeader(pluralizeTitles(items.length));
  els.libraryGrid.className = 'library-grid';

  if (items.length === 0) {
    els.libraryEmpty.classList.add('is-visible');
    renderEmptyState();
    return;
  }

  els.libraryEmpty.classList.remove('is-visible');

  items.forEach((item, index) => {
    els.libraryGrid.appendChild(createComicCard(item, onItemClick, index));
  });
}
