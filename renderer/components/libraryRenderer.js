import { getVisibleLibraryItems, isFavorite, LIBRARY_VIEWS, state, toggleFavoriteItem } from '../store/state.js';
import { els } from '../utils/dom.js';

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

export async function fetchAndDisplayCover(filePath, imgEl) {
  try {
    const ext = filePath.toLowerCase().split('.').pop();
    if (ext === 'pdf') {
      imgEl.src = '';
      return;
    }

    const base64Cover = await window.mhq.getComicCover(filePath);
    if (base64Cover) {
      imgEl.src = base64Cover;
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

function renderLibraryHeader(items) {
  const currentView = LIBRARY_VIEWS[state.activeLibraryView];

  if (els.libraryViewTitle) els.libraryViewTitle.textContent = currentView.title;
  if (els.libraryViewDescription) els.libraryViewDescription.textContent = currentView.description;
  if (els.librarySectionTitle) els.librarySectionTitle.textContent = currentView.sectionTitle;
  els.libraryMeta.textContent = pluralizeTitles(items.length);

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

export function renderLibraryItems(onItemClick) {
  els.libraryGrid.innerHTML = '';

  const items = getVisibleLibraryItems();
  renderLibraryHeader(items);

  if (items.length === 0) {
    els.libraryEmpty.classList.add('is-visible');
    renderEmptyState();
    return;
  }

  els.libraryEmpty.classList.remove('is-visible');

  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'library-card';
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
    subEl.textContent = recentDate
      ? `${item.extension.toUpperCase()} - ${cleanDir} - ${recentDate}`
      : `${item.extension.toUpperCase()} - ${cleanDir}`;

    card.appendChild(coverWrapper);
    card.appendChild(titleEl);
    card.appendChild(subEl);

    els.libraryGrid.appendChild(card);

    fetchAndDisplayCover(item.filePath, imgEl);
  });
}
