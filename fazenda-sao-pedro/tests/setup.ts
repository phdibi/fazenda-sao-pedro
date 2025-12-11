/**
 * Setup global para testes
 */

import { vi } from 'vitest';

// Mock do Firebase
vi.mock('../services/firebase', () => ({
  db: null,
  Timestamp: {
    fromDate: (date: Date) => ({ toDate: () => date }),
    now: () => ({ toDate: () => new Date() }),
  },
  FieldValue: {
    serverTimestamp: () => new Date(),
    arrayUnion: (...elements: any[]) => elements,
    arrayRemove: (...elements: any[]) => elements,
  },
}));

// Mock do localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock do matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock do ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock do IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
