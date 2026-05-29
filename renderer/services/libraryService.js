import { reconcileLibraryCollections, state } from '../store/state.js';
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
    state.libraryDirectories = scan.directories;
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
  if (!state.libraryDirectories.includes(selectedDirectory)) {
    state.libraryDirectories.push(selectedDirectory);
    await refreshLibrary(onComicOpen);
  }
}
