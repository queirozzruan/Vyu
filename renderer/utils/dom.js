export const els = {
  libraryScreen: document.getElementById('library-screen'),
  readerScreen: document.getElementById('reader-screen'),

  openComicBtn: document.getElementById('open-comic-btn'),
  addDirectoryBtn: document.getElementById('add-directory-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  openOtherBtn: document.getElementById('open-other-btn'),
  backLibraryBtn: document.getElementById('back-library-btn'),

  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  zoomInBtn: document.getElementById('zoom-in-btn'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),
  zoomValue: document.getElementById('zoom-value'),

  pageStage: document.getElementById('page-stage'),
  pageImage: document.getElementById('page-image'),
  loadingText: document.getElementById('loading-text'),
  loadingContainer: document.getElementById('loading-container'),
  
  readerSeries: document.getElementById('reader-series'),
  readerPageCounter: document.getElementById('reader-page-counter'),
  readerProgressBar: document.getElementById('reader-progress-bar'),

  libraryViewTabs: document.getElementById('library-view-tabs'),
  libraryViewTitle: document.getElementById('library-view-title'),
  libraryViewDescription: document.getElementById('library-view-description'),
  librarySectionTitle: document.getElementById('library-section-title'),
  libraryMeta: document.getElementById('library-meta'),
  directoryList: document.getElementById('directory-list'),
  libraryGrid: document.getElementById('library-grid'),
  libraryEmpty: document.getElementById('library-empty')
};

export function applyTheme(themeName) {
  const activeTheme = themeName === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = activeTheme;
  document.documentElement.classList.toggle('dark', activeTheme === 'dark');

  if (!els.themeToggleBtn) return;

  const icon = els.themeToggleBtn.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = activeTheme === 'dark' ? 'dark_mode' : 'light_mode';

  els.themeToggleBtn.setAttribute('aria-pressed', String(activeTheme === 'dark'));
  els.themeToggleBtn.title = activeTheme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro';
}

export function switchScreen(screenName) {
  if (screenName === 'library') {
    els.libraryScreen.classList.add('active');
    els.readerScreen.classList.remove('active');
    return;
  }

  els.libraryScreen.classList.remove('active');
  els.readerScreen.classList.add('active');
}

export function setLoading(message) {
  if (els.loadingText) els.loadingText.textContent = message;
  if (els.loadingContainer) els.loadingContainer.style.display = 'flex';
  els.pageImage.style.display = 'none';
}

export function hideLoading() {
  if (els.loadingContainer) els.loadingContainer.style.display = 'none';
  els.pageImage.style.display = 'block';
}
