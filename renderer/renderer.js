import { applyTheme, switchScreen, updateReaderModeControls } from './utils/dom.js';
import { READER_MODES, state } from './store/state.js';
import { updateHeader, updateZoomLabel, updateNavButtons } from './components/readerRenderer.js';
import { loadComicFromPath } from './services/readerService.js';
import { refreshLibrary } from './services/libraryService.js';
import { setupInputHandlers } from './events/inputHandlers.js';

// Setup all DOM and window event listeners
setupInputHandlers(loadComicFromPath);

// App initialization routine
applyTheme(state.activeTheme);
updateReaderModeControls(state.readerMode, READER_MODES);
switchScreen('library');
updateHeader();
updateZoomLabel();
updateNavButtons();
refreshLibrary(loadComicFromPath);
