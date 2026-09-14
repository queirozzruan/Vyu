import type { PreferenceSchema } from './types';

const STORAGE_KEYS: Record<keyof PreferenceSchema, string> = {
  directories: 'vyu:library-directories',
  recent: 'vyu:recent-items',
  favorites: 'vyu:favorite-items',
  seen: 'vyu:seen-items',
  view: 'vyu:active-library-view',
  theme: 'vyu:theme',
  readerMode: 'vyu:reader-mode',
  readingProgress: 'vyu:reading-progress'
};

const LEGACY_STORAGE_KEYS: Record<keyof PreferenceSchema, string> = {
  directories: 'mhqviewer:library-directories',
  recent: 'mhqviewer:recent-items',
  favorites: 'mhqviewer:favorite-items',
  seen: 'mhqviewer:seen-items',
  view: 'mhqviewer:active-library-view',
  theme: 'mhqviewer:theme',
  readerMode: 'mhqviewer:reader-mode',
  readingProgress: 'mhqviewer:reading-progress'
};

function readStorage<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? null : JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function readPreference<K extends keyof PreferenceSchema>(
  name: K,
  fallback: PreferenceSchema[K]
): PreferenceSchema[K] {
  return readStorage<PreferenceSchema[K]>(STORAGE_KEYS[name])
    ?? readStorage<PreferenceSchema[K]>(LEGACY_STORAGE_KEYS[name])
    ?? fallback;
}

export function writePreference<K extends keyof PreferenceSchema>(
  name: K,
  value: PreferenceSchema[K]
): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS[name], JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full; preferences must not break reading.
  }
}
