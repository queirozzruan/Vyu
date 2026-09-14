import type { LibraryTheme, ReaderModeName } from '../store/types';

interface ReaderModeOption {
  description: string;
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento obrigatorio nao encontrado: #${id}`);
  return element as T;
}

export const els = {
  libraryScreen: getRequiredElement<HTMLElement>('library-screen'),
  readerScreen: getRequiredElement<HTMLElement>('reader-screen'),

  openComicBtn: getRequiredElement<HTMLButtonElement>('open-comic-btn'),
  addDirectoryBtn: getRequiredElement<HTMLButtonElement>('add-directory-btn'),
  supportOpenBtn: getRequiredElement<HTMLButtonElement>('support-open-btn'),
  supportPage: getRequiredElement<HTMLElement>('support-page'),
  supportCloseBtn: getRequiredElement<HTMLButtonElement>('support-close-btn'),
  settingsBtn: getRequiredElement<HTMLButtonElement>('settings-btn'),
  settingsPanel: getRequiredElement<HTMLElement>('settings-panel'),
  settingsCloseBtn: getRequiredElement<HTMLButtonElement>('settings-close-btn'),
  readerModeOptions: getRequiredElement<HTMLElement>('reader-mode-options'),
  readerModeDescription: getRequiredElement<HTMLElement>('reader-mode-description'),
  themeToggleBtn: getRequiredElement<HTMLButtonElement>('theme-toggle-btn'),
  openOtherBtn: getRequiredElement<HTMLButtonElement>('open-other-btn'),
  backLibraryBtn: getRequiredElement<HTMLButtonElement>('back-library-btn'),

  prevBtn: getRequiredElement<HTMLButtonElement>('prev-btn'),
  nextBtn: getRequiredElement<HTMLButtonElement>('next-btn'),
  zoomInBtn: getRequiredElement<HTMLButtonElement>('zoom-in-btn'),
  zoomOutBtn: getRequiredElement<HTMLButtonElement>('zoom-out-btn'),
  zoomValue: getRequiredElement<HTMLElement>('zoom-value'),
  fitModeBtn: getRequiredElement<HTMLButtonElement>('fit-mode-btn'),
  readerPageSlider: getRequiredElement<HTMLInputElement>('reader-page-slider'),

  pageStage: getRequiredElement<HTMLElement>('page-stage'),
  pageScrollContent: getRequiredElement<HTMLElement>('page-scroll-content'),
  pageImage: getRequiredElement<HTMLImageElement>('page-image'),
  loadingText: getRequiredElement<HTMLElement>('loading-text'),
  loadingContainer: getRequiredElement<HTMLElement>('loading-container'),

  readerSeries: getRequiredElement<HTMLElement>('reader-series'),
  readerPageCounter: getRequiredElement<HTMLElement>('reader-page-counter'),

  libraryViewTabs: getRequiredElement<HTMLElement>('library-view-tabs'),
  libraryViewTitle: getRequiredElement<HTMLElement>('library-view-title'),
  libraryViewDescription: getRequiredElement<HTMLElement>('library-view-description'),
  librarySectionTitle: getRequiredElement<HTMLElement>('library-section-title'),
  libraryMeta: getRequiredElement<HTMLElement>('library-meta'),
  libraryGrid: getRequiredElement<HTMLElement>('library-grid'),
  libraryEmpty: getRequiredElement<HTMLElement>('library-empty')
};

export function applyTheme(themeName: LibraryTheme): void {
  const activeTheme = themeName === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = activeTheme;
  document.documentElement.classList.toggle('dark', activeTheme === 'dark');

  if (!els.themeToggleBtn) return;

  const icon = els.themeToggleBtn.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = activeTheme === 'dark' ? 'dark_mode' : 'light_mode';

  els.themeToggleBtn.setAttribute('aria-pressed', String(activeTheme === 'dark'));
  els.themeToggleBtn.title = activeTheme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro';
}

export function setSettingsPanelOpen(open: boolean): void {
  if (!els.settingsPanel) return;

  els.settingsPanel.classList.toggle('is-open', open);
  els.settingsPanel.setAttribute('aria-hidden', String(!open));
  els.settingsBtn?.setAttribute('aria-expanded', String(open));
}

export function setSupportPageOpen(open: boolean): void {
  if (!els.supportPage) return;

  els.supportPage.classList.toggle('is-open', open);
  els.supportPage.setAttribute('aria-hidden', String(!open));

  if (open) {
    els.supportCloseBtn?.focus();
  } else {
    els.supportOpenBtn?.focus();
  }
}

export function updateReaderModeControls(
  modeName: ReaderModeName,
  modes: Record<ReaderModeName, ReaderModeOption>
): void {
  if (!els.readerModeOptions) return;

  els.readerModeOptions.querySelectorAll<HTMLElement>('[data-reader-mode]').forEach((button) => {
    const active = button.dataset.readerMode === modeName;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', String(active));
  });

  if (els.readerModeDescription && modes[modeName]) {
    els.readerModeDescription.textContent = modes[modeName].description;
  }
}

export function switchScreen(screenName: 'library' | 'reader'): void {
  if (screenName === 'library') {
    els.libraryScreen.classList.add('active');
    els.readerScreen.classList.remove('active');
    return;
  }

  els.libraryScreen.classList.remove('active');
  els.readerScreen.classList.add('active');
}

export function setLoading(message: string): void {
  if (els.loadingText) els.loadingText.textContent = message;
  if (els.loadingContainer) els.loadingContainer.style.display = 'flex';
  els.pageImage.style.display = 'none';
}

export function hideLoading(): void {
  if (els.loadingContainer) els.loadingContainer.style.display = 'none';
  els.pageImage.style.display = 'block';
}
