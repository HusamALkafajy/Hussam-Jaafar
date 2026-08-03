import { describe, expect, it, vi } from 'vitest';
import { isPdfJsRuntime } from '../src/lib/pdfjs-runtime';

describe('PDF.js runtime shape validation', () => {
  it('accepts PDF.js 6 class-based GlobalWorkerOptions exports', () => {
    class GlobalWorkerOptions {
      static workerSrc = '';
    }

    expect(isPdfJsRuntime({ GlobalWorkerOptions, getDocument: vi.fn() })).toBe(true);
  });

  it('continues to accept object-based worker options used by focused mocks', () => {
    expect(isPdfJsRuntime({
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: vi.fn(),
    })).toBe(true);
  });

  it('rejects runtimes without writable worker-source configuration', () => {
    expect(isPdfJsRuntime({ GlobalWorkerOptions: {}, getDocument: vi.fn() })).toBe(false);
    expect(isPdfJsRuntime({ GlobalWorkerOptions: { workerSrc: '' } })).toBe(false);
  });
});
