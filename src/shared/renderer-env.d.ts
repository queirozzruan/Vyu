import type { MhqApi } from './ipc';

declare global {
  interface Window {
    mhq: MhqApi;
  }
}

export {};
