import { applyTheme, els, setSettingsPanelOpen, setSupportPageOpen, switchScreen, updateReaderModeControls } from '../utils/dom.js';
import { READER_MODES, setLibraryView, setReaderMode, state, toggleLibraryTheme } from '../store/state.js';
import { closeCurrentComic, goToPage, goToPreviousPage, goToNextPage, renderCurrentPage, setZoom, pickAndOpenComic, toggleFitMode } from '../services/readerService.js';
import { addDirectoryFlow } from '../services/libraryService.js';
import { renderLibraryItems } from '../components/libraryRenderer.js';
import { updateTransform, updateWebtoonPageFromScroll } from '../components/readerRenderer.js';
import type { ComicOpenHandler, LibraryViewName, ReaderModeName } from '../store/types';

const READER_MODE_NAMES: ReaderModeName[] = ['paged', 'webtoon'];
const LIBRARY_VIEW_NAMES: LibraryViewName[] = ['recent', 'favorites', 'collection'];

function isReaderModeName(value: string | undefined): value is ReaderModeName {
  return READER_MODE_NAMES.includes(value as ReaderModeName);
}

function isLibraryViewName(value: string | undefined): value is LibraryViewName {
  return LIBRARY_VIEW_NAMES.includes(value as LibraryViewName);
}

export function setupInputHandlers(onComicOpen: ComicOpenHandler): void {
  let readerUiTimer: number | null = null;
  const wakeReaderUi = () => {
    if (!els.readerScreen.classList.contains('active')) return;

    els.readerScreen.classList.remove('is-ui-idle');
    if (readerUiTimer !== null) window.clearTimeout(readerUiTimer);
    readerUiTimer = window.setTimeout(() => {
      els.readerScreen.classList.add('is-ui-idle');
    }, 2400);
  };

  window.addEventListener('keydown', (event) => {
    if (els.supportPage?.classList.contains('is-open') && event.key === 'Escape') {
      event.preventDefault();
      setSupportPageOpen(false);
      return;
    }

    if (!els.readerScreen.classList.contains('active')) return;

    wakeReaderUi();
    if (event.key === 'ArrowRight') { event.preventDefault(); goToNextPage(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goToPreviousPage(); }
    if (event.key === 'PageDown') { event.preventDefault(); goToNextPage(); }
    if (event.key === 'PageUp') { event.preventDefault(); goToPreviousPage(); }
    if (event.key === 'Home') { event.preventDefault(); goToPage(1); }
    if (event.key === 'End') { event.preventDefault(); goToPage(state.totalPages); }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFitMode(); }
    if (event.key === '0') { event.preventDefault(); setZoom(1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); els.pageStage.scrollTop -= 100; }
    if (event.key === 'ArrowDown') { event.preventDefault(); els.pageStage.scrollTop += 100; }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(state.zoom + 0.2); }
    if (event.key === '-' || event.key === '_') { event.preventDefault(); setZoom(state.zoom - 0.2); }
  });

  let isDragging = false;
  els.pageStage.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    wakeReaderUi();
    isDragging = true;
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    els.pageStage.scrollLeft -= event.movementX;
    els.pageStage.scrollTop -= event.movementY;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  els.pageStage.addEventListener('wheel', (event) => {
    wakeReaderUi();
    if (event.ctrlKey) {
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.2 : -0.2;
      setZoom(state.zoom + step);
    }
  }, { passive: false });

  els.pageStage.addEventListener('scroll', updateWebtoonPageFromScroll, { passive: true });
  els.readerScreen.addEventListener('mousemove', wakeReaderUi);
  window.addEventListener('resize', () => {
    if (els.readerScreen.classList.contains('active')) updateTransform();
  });

  // DOM Button Bindings
  els.supportOpenBtn?.addEventListener('click', () => setSupportPageOpen(true));
  els.supportCloseBtn?.addEventListener('click', () => setSupportPageOpen(false));
  els.supportPage?.addEventListener('click', (event) => {
    if (event.target === els.supportPage) {
      setSupportPageOpen(false);
    }
  });
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>('[data-external-link]');
    if (!link) return;

    event.preventDefault();
    window.mhq.openExternal(link.href);
  });
  els.openComicBtn.addEventListener('click', pickAndOpenComic);
  els.addDirectoryBtn.addEventListener('click', () => addDirectoryFlow(onComicOpen));
  els.themeToggleBtn?.addEventListener('click', () => {
    applyTheme(toggleLibraryTheme());
  });
  els.settingsBtn?.addEventListener('click', () => {
    const open = !els.settingsPanel?.classList.contains('is-open');
    setSettingsPanelOpen(open);
  });
  els.settingsCloseBtn?.addEventListener('click', () => setSettingsPanelOpen(false));
  els.readerModeOptions?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const option = target?.closest<HTMLElement>('[data-reader-mode]');
    const modeName = option?.dataset.readerMode;
    if (!isReaderModeName(modeName)) return;

    setReaderMode(modeName);
    updateReaderModeControls(state.readerMode, READER_MODES);

    if (els.readerScreen.classList.contains('active') && state.totalPages > 0) {
      state.zoom = 1;
      state.fitMode = state.readerMode === 'webtoon' ? 'width' : 'height';
      renderCurrentPage();
    }
  });
  els.openOtherBtn.addEventListener('click', pickAndOpenComic);
  els.backLibraryBtn.addEventListener('click', () => {
    renderLibraryItems(onComicOpen);
    switchScreen('library');
    closeCurrentComic();
  });
  els.prevBtn.addEventListener('click', goToPreviousPage);
  els.nextBtn.addEventListener('click', goToNextPage);
  els.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.2));
  els.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.2));
  els.fitModeBtn?.addEventListener('click', toggleFitMode);
  els.readerPageSlider?.addEventListener('change', (event) => {
    goToPage(Number(els.readerPageSlider.value));
  });

  els.libraryViewTabs?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest<HTMLElement>('[data-library-view]');
    const viewName = tab?.dataset.libraryView;
    if (!isLibraryViewName(viewName)) return;

    setLibraryView(viewName);
    renderLibraryItems(onComicOpen);
  });
}
