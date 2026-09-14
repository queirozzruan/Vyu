import { applyTheme, els, setSettingsPanelOpen, setSupportPageOpen, switchScreen, updateReaderModeControls } from '../utils/dom.js';
import { READER_MODES, setLibraryView, setReaderMode, state, toggleLibraryTheme } from '../store/state.js';
import { closeCurrentComic, goToPage, goToPreviousPage, goToNextPage, renderCurrentPage, setZoom, pickAndOpenComic, toggleFitMode } from '../services/readerService.js';
import { addDirectoryFlow } from '../services/libraryService.js';
import { renderLibraryItems } from '../components/libraryRenderer.js';
import { updateTransform, updateWebtoonPageFromScroll } from '../components/readerRenderer.js';

export function setupInputHandlers(onComicOpen) {
  let readerUiTimer = null;
  const wakeReaderUi = () => {
    if (!els.readerScreen.classList.contains('active')) return;

    els.readerScreen.classList.remove('is-ui-idle');
    window.clearTimeout(readerUiTimer);
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
    const link = event.target.closest('[data-external-link]');
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
    const option = event.target.closest('[data-reader-mode]');
    if (!option) return;

    setReaderMode(option.dataset.readerMode);
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
    goToPage(Number(event.target.value));
  });

  els.libraryViewTabs?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-library-view]');
    if (!tab) return;

    setLibraryView(tab.dataset.libraryView);
    renderLibraryItems(onComicOpen);
  });
}
