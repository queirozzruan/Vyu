import { getReadingProgress, rememberReadingProgress, rememberRecentItem, state } from '../store/state.js';
import { els, setLoading, hideLoading, switchScreen } from '../utils/dom.js';
import {
  clearWebtoonPages,
  createWebtoonPage,
  scrollToCurrentWebtoonPage,
  syncReaderModeClass,
  updateFitModeLabel,
  updateHeader,
  updateNavButtons,
  updateZoomLabel,
  resetView,
  updateTransform
} from '../components/readerRenderer.js';

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

export async function ensurePdfJs() {
  if (state.pdfjsLib) return state.pdfjsLib;
  const paths = await window.mhq.getPdfJsPaths();
  const pdfjsLib = await import(paths.moduleUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = paths.workerUrl;
  state.pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

export async function waitForImageLoad() {
  if (els.pageImage.complete && els.pageImage.naturalWidth > 0) return;

  await new Promise((resolve, reject) => {
    const onLoad = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Falha ao carregar imagem da p\u00e1gina.')); };
    const cleanup = () => {
      els.pageImage.removeEventListener('load', onLoad);
      els.pageImage.removeEventListener('error', onError);
    };
    els.pageImage.addEventListener('load', onLoad);
    els.pageImage.addEventListener('error', onError);
  });
}

export async function renderPdfPage(pageNumber, requestVersion) {
  const page = await state.pdfDocument.getPage(pageNumber);
  const viewportAt1x = page.getViewport({ scale: 1 });
  const viewportWidth = Math.max(100, els.pageStage.clientWidth - 40);
  const viewportHeight = Math.max(100, els.pageStage.clientHeight - 40);
  const fitScale = Math.min(viewportWidth / viewportAt1x.width, viewportHeight / viewportAt1x.height);

  const viewport = page.getViewport({ scale: fitScale * 1.5 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: context, viewport }).promise;

  if (requestVersion !== state.pageVersion) return;

  els.pageImage.src = canvas.toDataURL('image/png');
  els.pageImage.style.width = '';
  els.pageImage.style.height = '';
  hideLoading();
}

async function renderPdfPageToDataUrl(pageNumber, requestVersion) {
  const page = await state.pdfDocument.getPage(pageNumber);
  const viewportAt1x = page.getViewport({ scale: 1 });
  const viewportWidth = Math.max(320, els.pageStage.clientWidth - 160);
  const fitScale = viewportWidth / viewportAt1x.width;
  const viewport = page.getViewport({ scale: Math.min(fitScale * 1.5, 2.2) });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;

  if (requestVersion !== state.pageVersion) return null;

  return canvas.toDataURL('image/png');
}

async function renderWebtoonChapter(requestVersion) {
  setLoading('Montando cap\u00edtulo...');
  clearWebtoonPages();
  els.pageImage.style.display = 'none';

  if (state.kind === 'images') {
    state.imagePages.forEach((page, index) => {
      const img = document.createElement('img');
      img.src = page.src;
      img.loading = index < 3 || index <= state.currentPageIndex + 1 ? 'eager' : 'lazy';
      createWebtoonPage(index, img);
    });

    hideLoading();
    els.pageImage.style.display = 'none';
    updateTransform();
    resetView();
    scrollToCurrentWebtoonPage();
    return;
  }

  if (state.kind === 'pdf') {
    for (let index = 0; index < state.totalPages; index += 1) {
      setLoading(`Renderizando p\u00e1gina ${index + 1} de ${state.totalPages}...`);
      const dataUrl = await renderPdfPageToDataUrl(index + 1, requestVersion);
      if (!dataUrl || requestVersion !== state.pageVersion) return;

      const img = document.createElement('img');
      img.src = dataUrl;
      img.loading = index < 3 || index <= state.currentPageIndex + 1 ? 'eager' : 'lazy';
      createWebtoonPage(index, img);

      if (index === 0) {
        hideLoading();
        els.pageImage.style.display = 'none';
        updateTransform();
      }
    }

    hideLoading();
    els.pageImage.style.display = 'none';
    updateTransform();
    resetView();
    scrollToCurrentWebtoonPage();
  }
}

export async function renderCurrentPage() {
  if (state.totalPages === 0) {
    setLoading('Nenhuma p\u00e1gina dispon\u00edvel.');
    updateHeader();
    updateNavButtons();
    return;
  }

  updateHeader();
  updateNavButtons();

  if (state.rendering) {
    state.pendingRender = true;
    return;
  }

  state.rendering = true;
  state.pendingRender = false;
  state.pageVersion += 1;
  const requestVersion = state.pageVersion;

  try {
    syncReaderModeClass();

    let resetAfterRender = true;

    if (state.readerMode === 'webtoon') {
      await renderWebtoonChapter(requestVersion);
      resetAfterRender = false;
    } else if (state.kind === 'images') {
      clearWebtoonPages();
      const page = state.imagePages[state.currentPageIndex];
      if (!page) throw new Error('P\u00e1gina de imagem n\u00e3o encontrada.');

      setLoading('Carregando p\u00e1gina...');
      els.pageImage.src = page.src;
      await waitForImageLoad();

      state.currentImageNaturalWidth = els.pageImage.naturalWidth;
      state.currentImageNaturalHeight = els.pageImage.naturalHeight;
      hideLoading();
      preloadAdjacentImage();
    } else if (state.kind === 'pdf') {
      clearWebtoonPages();
      setLoading('Renderizando PDF...');
      await renderPdfPage(state.currentPageIndex + 1, requestVersion);
    }

    if (resetAfterRender) {
      resetView();
    }
  } catch (error) {
    setLoading(`Erro ao renderizar p\u00e1gina: ${error.message}`);
  } finally {
    state.rendering = false;
    if (state.pendingRender) {
      state.pendingRender = false;
      renderCurrentPage();
    }
  }
}

export function preloadAdjacentImage() {
  if (state.kind !== 'images') return;

  const nextPage = state.imagePages[state.currentPageIndex + 1] || state.imagePages[state.currentPageIndex - 1];
  if (!nextPage?.src) return;

  const image = new Image();
  image.src = nextPage.src;
}

export async function loadComicFromPath(filePath) {
  setLoading('Carregando arquivo...');
  switchScreen('reader');

  try {
    const result = await window.mhq.loadComic(filePath);
    state.title = result.title;
    state.currentFilePath = filePath;
    rememberRecentItem({ filePath, title: result.title });
    state.zoom = 1;
    state.fitMode = state.readerMode === 'webtoon' ? 'width' : 'height';
    state.imagePages = [];
    state.pdfDocument = null;

    if (result.kind === 'images') {
      state.kind = 'images';
      state.imagePages = result.pages;
      state.totalPages = result.pages.length;
    } else if (result.kind === 'pdf') {
      state.kind = 'pdf';
      const pdfjsLib = await ensurePdfJs();
      const pdfData = base64ToUint8Array(result.pdfBase64);
      state.pdfDocument = await pdfjsLib.getDocument({ data: pdfData }).promise;
      state.totalPages = state.pdfDocument.numPages;
    } else {
      throw new Error('Tipo de conteudo nao suportado pelo renderer.');
    }

    const savedProgress = getReadingProgress(filePath, state.totalPages);
    state.currentPageIndex = savedProgress?.pageIndex || 0;
    rememberReadingProgress({ filePath, pageIndex: state.currentPageIndex, totalPages: state.totalPages, title: result.title });

    updateZoomLabel();
    updateFitModeLabel();
    await renderCurrentPage();
    els.pageStage?.focus();
  } catch (error) {
    setLoading(`Falha ao abrir HQ: ${error.message}`);
    updateHeader();
    updateNavButtons();
  }
}

export async function pickAndOpenComic() {
  const filePath = await window.mhq.openComicFile();
  if (filePath) await loadComicFromPath(filePath);
}

export function goToNextPage() {
  goToPage(state.currentPageIndex + 2);
}

export function goToPreviousPage() {
  goToPage(state.currentPageIndex);
}

export function goToPage(pageNumber) {
  if (state.totalPages === 0) return;

  const nextIndex = clamp(Math.round(pageNumber) - 1, 0, state.totalPages - 1);
  if (nextIndex === state.currentPageIndex) return;

  state.currentPageIndex = nextIndex;
  rememberReadingProgress();
  if (state.readerMode === 'webtoon') {
    const pageEl = document.querySelector(`.webtoon-page[data-page-index="${nextIndex}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ block: 'start' });
      updateHeader();
      updateNavButtons();
      return;
    }
  }

  renderCurrentPage();
}

export function setZoom(newZoom) {
  const zoom = clamp(newZoom, 0.4, 4);
  if (Math.abs(zoom - state.zoom) < 0.001) return;
  state.zoom = zoom;
  updateZoomLabel();
  updateTransform();
}

export function toggleFitMode() {
  state.fitMode = state.fitMode === 'height' ? 'width' : 'height';
  updateFitModeLabel();
  resetView();
}
