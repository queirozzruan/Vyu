export const els = {
  libraryScreen: document.getElementById('library-screen'),
  readerScreen: document.getElementById('reader-screen'),

  openComicBtn: document.getElementById('open-comic-btn'),
  addDirectoryBtn: document.getElementById('add-directory-btn'),
  supportOpenBtn: document.getElementById('support-open-btn'),
  supportPage: document.getElementById('support-page'),
  supportCloseBtn: document.getElementById('support-close-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),
  readerModeOptions: document.getElementById('reader-mode-options'),
  readerModeDescription: document.getElementById('reader-mode-description'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  openOtherBtn: document.getElementById('open-other-btn'),
  backLibraryBtn: document.getElementById('back-library-btn'),

  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  zoomInBtn: document.getElementById('zoom-in-btn'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),
  zoomValue: document.getElementById('zoom-value'),
  fitModeBtn: document.getElementById('fit-mode-btn'),
  readerPageSlider: document.getElementById('reader-page-slider'),

  pageStage: document.getElementById('page-stage'),
  pageScrollContent: document.getElementById('page-scroll-content'),
  pageImage: document.getElementById('page-image'),
  loadingText: document.getElementById('loading-text'),
  loadingContainer: document.getElementById('loading-container'),
  
  readerSeries: document.getElementById('reader-series'),
  readerPageCounter: document.getElementById('reader-page-counter'),

  libraryViewTabs: document.getElementById('library-view-tabs'),
  libraryViewTitle: document.getElementById('library-view-title'),
  libraryViewDescription: document.getElementById('library-view-description'),
  librarySectionTitle: document.getElementById('library-section-title'),
  libraryMeta: document.getElementById('library-meta'),
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

export function setSettingsPanelOpen(open) {
  if (!els.settingsPanel) return;

  els.settingsPanel.classList.toggle('is-open', open);
  els.settingsPanel.setAttribute('aria-hidden', String(!open));
  els.settingsBtn?.setAttribute('aria-expanded', String(open));
}

export function setSupportPageOpen(open) {
  if (!els.supportPage) return;

  els.supportPage.classList.toggle('is-open', open);
  els.supportPage.setAttribute('aria-hidden', String(!open));

  if (open) {
    els.supportCloseBtn?.focus();
  } else {
    els.supportOpenBtn?.focus();
  }
}

export function updateReaderModeControls(modeName, modes) {
  if (!els.readerModeOptions) return;

  els.readerModeOptions.querySelectorAll('[data-reader-mode]').forEach((button) => {
    const active = button.dataset.readerMode === modeName;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', String(active));
  });

  if (els.readerModeDescription && modes[modeName]) {
    els.readerModeDescription.textContent = modes[modeName].description;
  }
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
