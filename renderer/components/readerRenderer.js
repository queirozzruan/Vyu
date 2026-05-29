import { state } from '../store/state.js';
import { els } from '../utils/dom.js';

export function updateTransform() {
  const content = els.pageImage;
  if (content) {
    const stageWidth = Math.max(320, (els.pageStage?.clientWidth || window.innerWidth) - 192);
    const stageHeight = Math.max(360, (els.pageStage?.clientHeight || window.innerHeight) - 150);

    if (state.fitMode === 'width') {
      content.style.width = `${Math.round(stageWidth * state.zoom)}px`;
      content.style.height = 'auto';
    } else {
      content.style.height = `${Math.round(stageHeight * state.zoom)}px`;
      content.style.width = 'auto';
    }

    content.style.maxWidth = 'none';
  }
}

export function resetView() {
  updateZoomLabel();
  updateTransform();
  if (els.pageStage) {
    els.pageStage.scrollTop = 0;
    els.pageStage.scrollLeft = 0;
  }
}

export function updateHeader() {
  els.readerSeries.textContent = state.title || '-';
  const current = state.totalPages === 0 ? 0 : state.currentPageIndex + 1;
  const pCurrent = String(current).padStart(3, '0');
  const pTotal = String(state.totalPages).padStart(3, '0');
  els.readerPageCounter.textContent = `P. ${pCurrent} / ${pTotal}`;
  const percentage = state.totalPages === 0 ? 0 : (current / state.totalPages) * 100;
  
  if (els.readerPageSlider) {
    els.readerPageSlider.max = String(Math.max(state.totalPages, 1));
    els.readerPageSlider.value = String(Math.max(current, 1));
    els.readerPageSlider.disabled = state.totalPages === 0;
    els.readerPageSlider.style.setProperty('--reader-progress', `${percentage}%`);
  }

}

export function updateZoomLabel() {
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
}

export function updateFitModeLabel() {
  const isWidth = state.fitMode === 'width';
  if (els.fitModeBtn) {
    els.fitModeBtn.title = isWidth ? 'Ajustar pela altura' : 'Ajustar pela largura';
    els.fitModeBtn.setAttribute('aria-pressed', String(isWidth));
  }
}

export function updateNavButtons() {
  const noPages = state.totalPages === 0;
  els.prevBtn.disabled = noPages || state.currentPageIndex <= 0;
  els.nextBtn.disabled = noPages || state.currentPageIndex >= state.totalPages - 1;
}
