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

const MAX_PAGED_IMAGE_CACHE_ITEMS = 10;
const WEBTOON_PRELOAD_AHEAD = 2;

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

function revokeObjectUrl(src) {
  if (typeof src === 'string' && src.startsWith('blob:')) {
    URL.revokeObjectURL(src);
  }
}

function clearImagePageCache() {
  state.imagePageCache.forEach(revokeObjectUrl);
  state.imagePageCache.clear();
  state.imagePagePromises.clear();
}

function trimImagePageCache() {
  if (state.readerMode === 'webtoon') return;

  const protectedIndexes = new Set([
    state.currentPageIndex - 1,
    state.currentPageIndex,
    state.currentPageIndex + 1
  ]);

  for (const [pageIndex, src] of state.imagePageCache) {
    if (state.imagePageCache.size <= MAX_PAGED_IMAGE_CACHE_ITEMS) break;
    if (protectedIndexes.has(pageIndex)) continue;

    revokeObjectUrl(src);
    state.imagePageCache.delete(pageIndex);
  }
}

function normalizeBinaryPageData(data) {
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return data;
  if (Array.isArray(data)) return new Uint8Array(data);
  return data;
}

function createPageObjectUrl(payload) {
  const data = normalizeBinaryPageData(payload?.data);
  if (!payload?.mime || !data) {
    throw new Error('Pagina de imagem invalida.');
  }

  return URL.createObjectURL(new Blob([data], { type: payload.mime }));
}

async function getImagePageSrc(pageIndex) {
  const page = state.imagePages[pageIndex];
  if (!page) throw new Error('Pagina de imagem nao encontrada.');
  if (page.src) return page.src;

  const cachedSrc = state.imagePageCache.get(pageIndex);
  if (cachedSrc) {
    state.imagePageCache.delete(pageIndex);
    state.imagePageCache.set(pageIndex, cachedSrc);
    return cachedSrc;
  }

  const pendingPage = state.imagePagePromises.get(pageIndex);
  if (pendingPage) return pendingPage;

  const filePath = state.currentFilePath;
  const pageName = page.name;
  let pagePromise;
  pagePromise = window.mhq.getComicPage(filePath, pageName)
    .then((payload) => {
      if (filePath !== state.currentFilePath) return null;

      const src = createPageObjectUrl(payload);
      state.imagePageCache.set(pageIndex, src);
      trimImagePageCache();
      return src;
    })
    .finally(() => {
      if (state.imagePagePromises.get(pageIndex) === pagePromise) {
        state.imagePagePromises.delete(pageIndex);
      }
    });

  state.imagePagePromises.set(pageIndex, pagePromise);
  return pagePromise;
}

export async function ensurePdfJs() {
  if (state.pdfjsLib) return state.pdfjsLib;
  const paths = await window.mhq.getPdfJsPaths();
  const pdfjsLib = await import(paths.moduleUrl);
  pdfjsLib.GlobalWorkerOptions.workerSrc = paths.workerUrl;
  state.pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

async function releaseCurrentContent() {
  state.pageVersion += 1;
  clearWebtoonPages();
  clearImagePageCache();

  if (state.pdfDocument?.destroy) {
    await state.pdfDocument.destroy().catch(() => {});
  }

  state.pdfDocument = null;
  state.imagePages = [];
  state.currentFilePath = '';
  state.kind = null;
  state.totalPages = 0;
}

export async function closeCurrentComic() {
  await releaseCurrentContent();
  updateHeader();
  updateNavButtons();
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

function markWebtoonImageLoaded(img) {
  const page = img.closest('.webtoon-page');
  page?.classList.remove('is-loading');
  page?.classList.add('is-loaded');
}

async function loadWebtoonImage(img, pageIndex, requestVersion) {
  if (!img || img.dataset.loadState === 'loaded') return;
  if (img.vyuLoadPromise) return img.vyuLoadPromise;

  img.dataset.loadState = 'loading';
  img.vyuLoadPromise = getImagePageSrc(pageIndex)
    .then((src) => {
      if (!src || requestVersion !== state.pageVersion || !img.isConnected) return;

      img.addEventListener('load', () => {
        img.dataset.loadState = 'loaded';
        markWebtoonImageLoaded(img);
      }, { once: true });
      img.src = src;
    })
    .catch((error) => {
      img.dataset.loadState = 'error';
      console.error('Error loading webtoon page', pageIndex, error);
    })
    .finally(() => {
      img.vyuLoadPromise = null;
    });

  return img.vyuLoadPromise;
}

async function loadWebtoonPdfPage(img, pageIndex, requestVersion) {
  if (!img || img.dataset.loadState === 'loaded') return;
  if (img.vyuLoadPromise) return img.vyuLoadPromise;

  img.dataset.loadState = 'loading';
  img.vyuLoadPromise = renderPdfPageToDataUrl(pageIndex + 1, requestVersion)
    .then((dataUrl) => {
      if (!dataUrl || requestVersion !== state.pageVersion || !img.isConnected) return;

      img.addEventListener('load', () => {
        img.dataset.loadState = 'loaded';
        markWebtoonImageLoaded(img);
      }, { once: true });
      img.src = dataUrl;
    })
    .catch((error) => {
      img.dataset.loadState = 'error';
      console.error('Error rendering webtoon PDF page', pageIndex, error);
    })
    .finally(() => {
      img.vyuLoadPromise = null;
    });

  return img.vyuLoadPromise;
}

function setupWebtoonPageObserver(images, requestVersion, loadPage) {
  if (state.webtoonImageObserver) {
    state.webtoonImageObserver.disconnect();
  }

  if (!('IntersectionObserver' in window)) {
    images.forEach((img, index) => loadPage(img, index, requestVersion));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const img = entry.target;
      const pageIndex = Number(img.dataset.pageIndex || 0);
      observer.unobserve(img);
      loadPage(img, pageIndex, requestVersion);
    });
  }, {
    root: els.pageStage,
    rootMargin: '900px 0px'
  });

  state.webtoonImageObserver = observer;
  images.forEach((img) => observer.observe(img));
}

function preloadWebtoonPages(images, requestVersion, loadPage) {
  const indexes = new Set([0, state.currentPageIndex]);

  for (let offset = 1; offset <= WEBTOON_PRELOAD_AHEAD; offset += 1) {
    indexes.add(state.currentPageIndex + offset);
  }

  indexes.forEach((pageIndex) => {
    if (pageIndex >= 0 && pageIndex < images.length) {
      loadPage(images[pageIndex], pageIndex, requestVersion);
    }
  });
}

async function renderWebtoonChapter(requestVersion) {
  setLoading('Montando cap\u00edtulo...');
  clearWebtoonPages();
  els.pageImage.style.display = 'none';

  if (state.kind === 'images') {
    const images = state.imagePages.map((_page, index) => {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      createWebtoonPage(index, img).classList.add('is-loading');
      return img;
    });

    setupWebtoonPageObserver(images, requestVersion, loadWebtoonImage);
    preloadWebtoonPages(images, requestVersion, loadWebtoonImage);
    await loadWebtoonImage(images[state.currentPageIndex], state.currentPageIndex, requestVersion);

    hideLoading();
    els.pageImage.style.display = 'none';
    updateTransform();
    resetView();
    scrollToCurrentWebtoonPage();
    return;
  }

  if (state.kind === 'pdf') {
    const images = Array.from({ length: state.totalPages }, (_page, index) => {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      createWebtoonPage(index, img).classList.add('is-loading');
      return img;
    });

    setupWebtoonPageObserver(images, requestVersion, loadWebtoonPdfPage);
    preloadWebtoonPages(images, requestVersion, loadWebtoonPdfPage);
    await loadWebtoonPdfPage(images[state.currentPageIndex], state.currentPageIndex, requestVersion);

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
      const src = await getImagePageSrc(state.currentPageIndex);
      if (!src || requestVersion !== state.pageVersion) return;

      els.pageImage.src = src;
      await waitForImageLoad();
      if (requestVersion !== state.pageVersion) return;

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

  const nearbyPages = [
    state.currentPageIndex + 1,
    state.currentPageIndex - 1
  ].filter((pageIndex) => pageIndex >= 0 && pageIndex < state.totalPages);

  nearbyPages.forEach((pageIndex) => {
    getImagePageSrc(pageIndex)
      .then((src) => {
        if (!src) return;
        const image = new Image();
        image.src = src;
      })
      .catch(() => {});
  });
}

export async function loadComicFromPath(filePath) {
  setLoading('Carregando arquivo...');
  switchScreen('reader');

  try {
    await releaseCurrentContent();

    const result = await window.mhq.loadComic(filePath);
    state.title = result.title;
    state.currentFilePath = filePath;
    rememberRecentItem({ filePath, title: result.title });
    state.zoom = 1;
    state.fitMode = state.readerMode === 'webtoon' ? 'width' : 'height';

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
