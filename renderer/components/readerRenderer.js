import { rememberReadingProgress, state } from '../store/state.js';
import { els } from '../utils/dom.js';

function getReadableStageSize() {
  return {
    width: Math.max(320, (els.pageStage?.clientWidth || window.innerWidth) - 192),
    height: Math.max(360, (els.pageStage?.clientHeight || window.innerHeight) - 150)
  };
}

function getPageMediaElements() {
  return [
    els.pageImage,
    ...Array.from(document.querySelectorAll('.webtoon-page-media'))
  ].filter(Boolean);
}

export function updateTransform() {
  const { width: stageWidth, height: stageHeight } = getReadableStageSize();

  getPageMediaElements().forEach((content) => {
    if (state.fitMode === 'width') {
      content.style.width = `${Math.round(stageWidth * state.zoom)}px`;
      content.style.height = 'auto';
    } else {
      content.style.height = `${Math.round(stageHeight * state.zoom)}px`;
      content.style.width = 'auto';
    }

    content.style.maxWidth = 'none';
  });
}

export function clearWebtoonPages() {
  document.querySelectorAll('.webtoon-page').forEach((page) => page.remove());
}

export function createWebtoonPage(pageIndex, mediaElement) {
  const page = document.createElement('div');
  page.className = 'webtoon-page';
  page.dataset.pageIndex = String(pageIndex);

  mediaElement.classList.add('webtoon-page-media');
  mediaElement.dataset.pageIndex = String(pageIndex);
  mediaElement.alt = `P\u00e1gina ${pageIndex + 1}`;
  page.appendChild(mediaElement);
  els.pageScrollContent.appendChild(page);

  return page;
}

export function syncReaderModeClass() {
  els.readerScreen.classList.toggle('is-webtoon', state.readerMode === 'webtoon');
}

export function updateWebtoonPageFromScroll() {
  if (state.readerMode !== 'webtoon') return;

  const pages = Array.from(document.querySelectorAll('.webtoon-page'));
  if (pages.length === 0) return;

  const stageTop = els.pageStage.getBoundingClientRect().top;
  const targetY = stageTop + 120;
  let activeIndex = 0;

  for (const page of pages) {
    const rect = page.getBoundingClientRect();
    if (rect.top <= targetY) {
      activeIndex = Number(page.dataset.pageIndex || 0);
    }
  }

  if (activeIndex !== state.currentPageIndex) {
    state.currentPageIndex = activeIndex;
    rememberReadingProgress();
    updateHeader();
    updateNavButtons();
  }
}

export function scrollToCurrentWebtoonPage() {
  const page = document.querySelector(`.webtoon-page[data-page-index="${state.currentPageIndex}"]`);
  if (!page) return;

  const scrollToPage = () => {
    if (!page.isConnected) return;
    page.scrollIntoView({ block: 'start' });
    updateHeader();
    updateNavButtons();
  };

  window.requestAnimationFrame(scrollToPage);
  window.setTimeout(scrollToPage, 250);
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
