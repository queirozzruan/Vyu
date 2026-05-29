import { switchScreen } from './utils/dom.js';
import { updateHeader, updateZoomLabel, updateNavButtons } from './components/readerRenderer.js';
import { loadComicFromPath } from './services/readerService.js';
import { refreshLibrary } from './services/libraryService.js';
import { setupInputHandlers } from './events/inputHandlers.js';

// Setup all DOM and window event listeners
setupInputHandlers(loadComicFromPath);

// App initialization routine
switchScreen('library');
updateHeader();
updateZoomLabel();
updateNavButtons();
refreshLibrary(loadComicFromPath);
