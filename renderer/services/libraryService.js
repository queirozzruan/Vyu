import { addLibraryDirectory, persistLibraryDirectories, reconcileLibraryCollections, state } from '../store/state.js';
import { renderDirectoryList, renderLibraryItems } from '../components/libraryRenderer.js';

export async function refreshLibrary(onComicOpen) {
  renderDirectoryList();
  if (state.libraryDirectories.length === 0) {
    state.libraryItems = [];
    renderLibraryItems(onComicOpen);
    return;
  }
  
  try {
    const scan = await window.mhq.scanLibraryDirectories(state.libraryDirectories);
    persistLibraryDirectories(scan.directories);
    state.libraryItems = scan.items;
    reconcileLibraryCollections(state.libraryItems);
  } catch (error) {
    state.libraryItems = [];
    console.error(error);
  }
  
  renderDirectoryList();
  renderLibraryItems(onComicOpen);
}

export async function addDirectoryFlow(onComicOpen) {
  const selectedDirectory = await window.mhq.openComicDirectory();
  if (!selectedDirectory) {
    return;
  }
  const previousCount = state.libraryDirectories.length;
  addLibraryDirectory(selectedDirectory);

  if (state.libraryDirectories.length !== previousCount) {
    await refreshLibrary(onComicOpen);
  }
}
