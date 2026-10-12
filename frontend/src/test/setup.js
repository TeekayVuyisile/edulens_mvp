import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { restoreApi } from './utils';

// jsdom lacks matchMedia, which framer-motion uses for reduced-motion checks.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

afterEach(() => {
  cleanup();
  restoreApi();
  localStorage.clear();
  vi.restoreAllMocks();
});

// Pages are lazy-loaded; the first import of a page can take over a second in jsdom.
configure({ asyncUtilTimeout: 5000 });
