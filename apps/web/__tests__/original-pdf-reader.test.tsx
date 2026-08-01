import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OriginalPdfReader } from '../src/components/reader/original-pdf-reader';
import { authenticatedFetch } from '../src/lib/api-client';
import { loadPdfJsRuntime } from '../src/lib/pdfjs-runtime';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as LocaleHook from '../src/hooks/use-locale';

// Mock dependencies
vi.mock('../src/lib/api-client', () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock('../src/lib/pdfjs-runtime', () => ({
  loadPdfJsRuntime: vi.fn(),
}));

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
class IntersectionObserverMock {
  constructor(callback: any) {
    (this as any).callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverMock as any;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock Canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  scale: vi.fn(),
  drawImage: vi.fn(),
  clearRect: vi.fn(),
}) as any;

const defaultLabels = {
  loading: 'Loading PDF...',
  failed: 'Failed to load PDF',
  retry: 'Retry',
  previous: 'Previous Page',
  next: 'Next Page',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  fitWidth: 'Fit Width',
  page: 'Page',
};

describe('OriginalPdfReader', () => {
  let mockGetDocument: any;
  let mockPdfDoc: any;
  let mockPage1: any;
  let mockPage2: any;

  beforeEach(() => {
    vi.spyOn(LocaleHook, 'useLocale').mockReturnValue({ dir: 'ltr', locale: 'en', t: (k) => k } as any);

    mockPage1 = {
      getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() }),
    };

    mockPage2 = {
      getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() }),
    };

    mockPdfDoc = {
      numPages: 2,
      getPage: vi.fn().mockImplementation((num) => Promise.resolve(num === 1 ? mockPage1 : mockPage2)),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve(mockPdfDoc),
    });

    (loadPdfJsRuntime as any).mockResolvedValue({
      getDocument: mockGetDocument,
    });

    (authenticatedFetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('A. Successful multi-page rendering contract', async () => {
    render(
      <OriginalPdfReader
        fileId="file-123"
        label="Original PDF"
        labels={defaultLabels}
      />
    );

    // 1. Initial loading state
    expect(screen.getByText('Loading PDF...')).toBeTruthy();

    await waitFor(() => {
      // 2. authenticated request made
      expect(authenticatedFetch).toHaveBeenCalledWith('/files/file-123/original', expect.any(Object));
      
      // 3. runtime loader called
      expect(loadPdfJsRuntime).toHaveBeenCalled();
    });

    // 4. getDocument receives real byte-like data & isEvalSupported is false
    expect(mockGetDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Uint8Array),
        isEvalSupported: false,
      })
    );

    // 5. Document with 2 pages is processed (Page count displays 2)
    await waitFor(() => {
      expect(screen.getByText('Page 1 / 2')).toBeTruthy();
    });

    // 6. Both canvases are created/rendered
    const canvases = document.querySelectorAll('canvas');
    expect(canvases.length).toBe(2);

    expect(mockPdfDoc.getPage).toHaveBeenCalledWith(1);
    expect(mockPdfDoc.getPage).toHaveBeenCalledWith(2);

    await waitFor(() => {
      expect(mockPage1.render).toHaveBeenCalled();
      expect(mockPage2.render).toHaveBeenCalled();
    });

    // 7. Navigation controls
    const nextBtn = screen.getByRole('button', { name: 'Next Page' });
    const prevBtn = screen.getByRole('button', { name: 'Previous Page' });

    expect((prevBtn as HTMLButtonElement).disabled).toBeTruthy();
    expect((nextBtn as HTMLButtonElement).disabled).toBeFalsy();

    // Click Next
    fireEvent.click(nextBtn);
    expect(screen.getByText('Page 2 / 2')).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect((nextBtn as HTMLButtonElement).disabled).toBeTruthy();
    expect((prevBtn as HTMLButtonElement).disabled).toBeFalsy();

    // Click Previous
    fireEvent.click(prevBtn);
    expect(screen.getByText('Page 1 / 2')).toBeTruthy();

    // 8. Zoom in/out
    const zoomInBtn = screen.getByRole('button', { name: 'Zoom In' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom Out' });

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('125%')).toBeTruthy();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeTruthy();

    // 9. Fit-width can be selected
    const fitWidthBtn = screen.getByRole('button', { name: 'Fit Width' });
    fireEvent.click(fitWidthBtn);
    
    // No placeholder check
    expect(screen.queryByText('/tmp')).not.toBeTruthy();
  });

  it('B. Failure and retry contract', async () => {
    (authenticatedFetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(
      <OriginalPdfReader
        fileId="file-bad"
        label="Original PDF"
        labels={defaultLabels}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load PDF')).toBeTruthy();
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    expect(retryBtn).toBeTruthy();

    // Setup success for retry
    (authenticatedFetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Page 1 / 2')).toBeTruthy();
    });
  });
});
