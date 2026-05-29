import { applyTheme, els, switchScreen } from '../utils/dom.js';
import { setLibraryView, state, toggleLibraryTheme } from '../store/state.js';
import { goToPreviousPage, goToNextPage, setZoom, pickAndOpenComic } from '../services/readerService.js';
import { addDirectoryFlow } from '../services/libraryService.js';
import { renderLibraryItems } from '../components/libraryRenderer.js';

export function setupInputHandlers(onComicOpen) {
  window.addEventListener('keydown', (event) => {
    if (!els.readerScreen.classList.contains('active')) return;

    if (event.key === 'ArrowRight') { event.preventDefault(); goToNextPage(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goToPreviousPage(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); els.pageStage.scrollTop -= 100; }
    if (event.key === 'ArrowDown') { event.preventDefault(); els.pageStage.scrollTop += 100; }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(state.zoom + 0.2); }
    if (event.key === '-' || event.key === '_') { event.preventDefault(); setZoom(state.zoom - 0.2); }
  });

  let isDragging = false;
  els.pageStage.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    isDragging = true;
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    els.pageStage.scrollLeft -= event.movementX;
    els.pageStage.scrollTop -= event.movementY;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  els.pageStage.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.15 : -0.15;
      setZoom(state.zoom + step);
    }
  }, { passive: false });

  // DOM Button Bindings
  els.openComicBtn.addEventListener('click', pickAndOpenComic);
  els.addDirectoryBtn.addEventListener('click', () => addDirectoryFlow(onComicOpen));
  els.themeToggleBtn?.addEventListener('click', () => {
    applyTheme(toggleLibraryTheme());
  });
  els.openOtherBtn.addEventListener('click', pickAndOpenComic);
  els.backLibraryBtn.addEventListener('click', () => {
    renderLibraryItems(onComicOpen);
    switchScreen('library');
  });
  els.prevBtn.addEventListener('click', goToPreviousPage);
  els.nextBtn.addEventListener('click', goToNextPage);
  els.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.1));
  els.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.1));

  els.libraryViewTabs?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-library-view]');
    if (!tab) return;

    setLibraryView(tab.dataset.libraryView);
    renderLibraryItems(onComicOpen);
  });
}
