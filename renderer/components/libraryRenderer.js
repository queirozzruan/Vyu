import { getLibraryFolderGroups, getReadingProgressPercent, getVisibleLibraryItems, isFavorite, LIBRARY_VIEWS, state, toggleFavoriteItem } from '../store/state.js';
import { els } from '../utils/dom.js';

const coverPreviewCache = new Map();
const PDF_PREVIEW_MAX_WIDTH = 360;
const PDF_PREVIEW_MAX_HEIGHT = 540;

export function renderDirectoryList() {
  els.directoryList.innerHTML = '';

  if (state.libraryDirectories.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'directory-chip is-empty';
    empty.textContent = 'Nenhuma pasta adicionada';
    els.directoryList.appendChild(empty);
    return;
  }

  for (const dir of state.libraryDirectories) {
    const chip = document.createElement('span');
    chip.className = 'directory-chip';
    chip.title = dir;
    chip.textContent = dir.split(/[\\/]/).pop();
    els.directoryList.appendChild(chip);
  }
}

function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

async function ensurePdfJs() {
  if (state.pdfjsLib) return state.pdfjsLib;

  const paths = await window.mhq.getPdfJsPaths();
  const pdfjsLib = await import(paths.moduleUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = paths.workerUrl;
  state.pdfjsLib = pdfjsLib;

  return pdfjsLib;
}

async function renderPdfFirstPagePreview(filePath) {
  const result = await window.mhq.loadComic(filePath);
  if (!result?.pdfBase64) return null;

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

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    if (pdfDocument?.destroy) await pdfDocument.destroy();
  }
}

async function createCoverPreview(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    return renderPdfFirstPagePreview(filePath);
  }

  return window.mhq.getComicCover(filePath);
}

function getCoverPreview(filePath) {
  if (!coverPreviewCache.has(filePath)) {
    coverPreviewCache.set(
      filePath,
      createCoverPreview(filePath).catch((err) => {
        coverPreviewCache.delete(filePath);
        throw err;
      })
    );
  }

  return coverPreviewCache.get(filePath);
}

export async function fetchAndDisplayCover(filePath, imgEl) {
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

function formatDirectory(item) {
  if (!item.directory) return 'Arquivo local';
  return item.directory.replace(/\\/g, '/').split('/').pop() || 'Arquivo local';
}

function formatRecentDate(timestamp) {
  if (!timestamp) return null;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atr\u00e1s`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function pluralizeTitles(count) {
  return `${count} ${count === 1 ? 't\u00edtulo' : 't\u00edtulos'}`;
}

function pluralizeFolders(count) {
  return `${count} ${count === 1 ? 'pasta' : 'pastas'}`;
}

function renderLibraryHeader(metaText) {
  const currentView = LIBRARY_VIEWS[state.activeLibraryView];

  if (els.libraryViewTitle) els.libraryViewTitle.textContent = currentView.title;
  if (els.libraryViewDescription) els.libraryViewDescription.textContent = currentView.description;
  if (els.librarySectionTitle) els.librarySectionTitle.textContent = currentView.sectionTitle;
  els.libraryMeta.textContent = metaText;

  if (!els.libraryViewTabs) return;

  els.libraryViewTabs.querySelectorAll('[data-library-view]').forEach((tab) => {
    const isActive = tab.dataset.libraryView === state.activeLibraryView;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
}

function renderEmptyState() {
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

function createComicCard(item, onItemClick, index, { compact = false } = {}) {
  const card = document.createElement('div');
  card.className = `library-card${compact ? ' is-compact' : ''}`;
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
  imgEl.alt = `Preview de ${item.title}`;

  const favoriteButton = document.createElement('button');
  const favorite = isFavorite(item.filePath);
  favoriteButton.className = `favorite-btn${favorite ? ' is-favorite' : ''}`;
  favoriteButton.type = 'button';
  favoriteButton.title = favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  favoriteButton.setAttribute('aria-pressed', String(favorite));
  favoriteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleFavoriteItem(item);
    renderLibraryItems(onItemClick);
  });

  const favoriteIcon = document.createElement('span');
  favoriteIcon.className = 'material-symbols-outlined';
  favoriteIcon.textContent = 'star';

  const overlay = document.createElement('div');
  overlay.className = 'cover-accent';

  const progress = document.createElement('div');
  progress.className = 'cover-accent-fill';
  progress.style.width = `${getReadingProgressPercent(item.filePath)}%`;

  favoriteButton.appendChild(favoriteIcon);
  overlay.appendChild(progress);
  coverWrapper.appendChild(icon);
  coverWrapper.appendChild(imgEl);
  coverWrapper.appendChild(favoriteButton);
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

function renderFolderGroups(groups, onItemClick) {
  groups.forEach((group, groupIndex) => {
    const section = document.createElement('section');
    section.className = 'folder-section';
    section.style.animationDelay = `${Math.min(groupIndex * 0.05, 0.5)}s`;

    const heading = document.createElement('div');
    heading.className = 'folder-heading';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined folder-icon';
    icon.textContent = 'folder';

    const copy = document.createElement('div');
    copy.className = 'folder-copy';

    const title = document.createElement('h3');
    title.textContent = group.name;

    const meta = document.createElement('p');
    meta.title = group.directory;
    meta.textContent = `${pluralizeTitles(group.items.length)} - ${group.directory || 'Arquivos locais'}`;

    const grid = document.createElement('div');
    grid.className = 'folder-comics-grid';

    group.items.forEach((item, itemIndex) => {
      grid.appendChild(createComicCard(item, onItemClick, itemIndex, { compact: true }));
    });

    copy.appendChild(title);
    copy.appendChild(meta);
    heading.appendChild(icon);
    heading.appendChild(copy);
    section.appendChild(heading);
    section.appendChild(grid);
    els.libraryGrid.appendChild(section);
  });
}

export function renderLibraryItems(onItemClick) {
  els.libraryGrid.innerHTML = '';

  if (state.activeLibraryView === 'collection') {
    const groups = getLibraryFolderGroups();
    const totalItems = state.libraryItems.length;
    renderLibraryHeader(`${pluralizeFolders(groups.length)} - ${pluralizeTitles(totalItems)}`);
    els.libraryGrid.className = 'folder-stack';

    if (groups.length === 0) {
      els.libraryEmpty.classList.add('is-visible');
      renderEmptyState();
      return;
    }

    els.libraryEmpty.classList.remove('is-visible');
    renderFolderGroups(groups, onItemClick);
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
