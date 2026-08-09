import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OriginalPdfReader } from '../src/components/reader/original-pdf-reader';
import { authenticatedFetch } from '../src/lib/api-client';
import {
  loadPdfJsRuntime,
  type PdfDocumentLoadingTask,
  type PdfDocumentProxy,
  type PdfJsRuntime,
  type PdfPageProxy,
  type PdfRenderTask,
} from '../src/lib/pdfjs-runtime';
import * as LocaleHook from '../src/hooks/use-locale';

vi.mock('../src/lib/api-client', () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock('../src/lib/pdfjs-runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/pdfjs-runtime')>();
  return { ...original, loadPdfJsRuntime: vi.fn() };
});

class ResizeObserverMock implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  unobserve(): void {}

  notify(entries: IntersectionObserverEntry[]): void {
    this.callback(entries, this);
  }
}

function intersectionEntry(target: Element, intersectionRatio: number): IntersectionObserverEntry {
  return {
    target,
    intersectionRatio,
    isIntersecting: intersectionRatio > 0,
  } as IntersectionObserverEntry;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

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

const rtlLabels = {
  ...defaultLabels,
  previous: 'الصفحة السابقة',
  next: 'الصفحة التالية',
  page: 'الصفحة',
};

const mockedFetch = vi.mocked(authenticatedFetch);
const mockedLoadRuntime = vi.mocked(loadPdfJsRuntime);

function pdfResponse(contents = '%PDF-fixture'): Response {
  return {
    ok: true,
    status: 200,
    blob: () => Promise.resolve(new Blob([contents], { type: 'application/pdf' })),
  } as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status } as Response;
}

describe('OriginalPdfReader', () => {
  let intersectionObserver: IntersectionObserverMock | null;
  let pageOneRenderTask: PdfRenderTask;
  let pageTwoRenderTask: PdfRenderTask;
  let pageOne: PdfPageProxy;
  let pageTwo: PdfPageProxy;
  let pdfDocument: PdfDocumentProxy;
  let loadingTask: PdfDocumentLoadingTask;
  let runtime: PdfJsRuntime;
  let getPage: ReturnType<typeof vi.fn>;
  let getDocument: ReturnType<typeof vi.fn>;
  let destroyLoadingTask: ReturnType<typeof vi.fn>;
  let renderPageOne: ReturnType<typeof vi.fn>;
  let renderPageTwo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(LocaleHook, 'useLocale').mockReturnValue({
      dir: 'ltr',
      locale: 'en',
      setLocale: vi.fn(),
      t: (key: string) => key,
    });
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    intersectionObserver = null;
    vi.stubGlobal('IntersectionObserver', class extends IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        super(callback);
        intersectionObserver = this;
      }
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    const canvasContext = { scale: vi.fn() } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => canvasContext),
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:studyai-pdf-reader'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    pageOneRenderTask = { promise: Promise.resolve(), cancel: vi.fn() };
    pageTwoRenderTask = { promise: Promise.resolve(), cancel: vi.fn() };
    renderPageOne = vi.fn(() => pageOneRenderTask);
    renderPageTwo = vi.fn(() => pageTwoRenderTask);
    pageOne = {
      getViewport: vi.fn(() => ({ width: 600, height: 800 })),
      render: renderPageOne,
    };
    pageTwo = {
      getViewport: vi.fn(() => ({ width: 600, height: 800 })),
      render: renderPageTwo,
    };
    getPage = vi.fn((pageNumber: number) => Promise.resolve(pageNumber === 1 ? pageOne : pageTwo));
    pdfDocument = { numPages: 2, getPage };
    destroyLoadingTask = vi.fn(() => Promise.resolve());
    loadingTask = { promise: Promise.resolve(pdfDocument), destroy: destroyLoadingTask };
    getDocument = vi.fn(() => loadingTask);
    runtime = {
      GlobalWorkerOptions: { workerSrc: '/vendor/pdfjs/pdf.worker.mjs' },
      getDocument,
    };

    mockedLoadRuntime.mockResolvedValue(runtime);
    mockedFetch.mockImplementation(() => Promise.resolve(pdfResponse()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches authenticated PDF bytes and renders both pages with the toolbar controls', async () => {
    render(<OriginalPdfReader fileId="file-123" label="Original PDF" labels={defaultLabels} />);

    expect(screen.getByText('Loading PDF...')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());

    expect(mockedFetch).toHaveBeenCalledWith('/files/file-123/original', {
      signal: expect.any(AbortSignal),
    });
    expect(getDocument).toHaveBeenCalledWith({
      url: 'blob:studyai-pdf-reader',
      isEvalSupported: false,
    });
    await waitFor(() => {
      expect(getPage).toHaveBeenCalledWith(1);
      expect(getPage).toHaveBeenCalledWith(2);
      expect(renderPageOne).toHaveBeenCalledTimes(1);
      expect(renderPageTwo).toHaveBeenCalledTimes(1);
    });
    expect(document.querySelectorAll('canvas')).toHaveLength(2);

    const previous = screen.getByRole('button', { name: 'Previous Page' });
    const next = screen.getByRole('button', { name: 'Next Page' });
    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(next);
    expect(screen.getByText('Page 2 / 2')).toBeTruthy();
    expect((previous as HTMLButtonElement).disabled).toBe(false);
    expect((next as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(previous);
    expect(screen.getByText('Page 1 / 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }));
    expect(screen.getByText('125%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom Out' }));
    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fit Width' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps Arabic Previous and Next controls bound to logical document order', async () => {
    vi.mocked(LocaleHook.useLocale).mockReturnValue({
      dir: 'rtl',
      locale: 'ar',
      setLocale: vi.fn(),
      t: (key: string) => key,
    });

    render(<OriginalPdfReader fileId="file-rtl-navigation" label="المستند الأصلي" labels={rtlLabels} />);
    await waitFor(() => expect(screen.getByText('الصفحة 1 / 2')).toBeTruthy());

    const previous = screen.getByRole('button', { name: 'الصفحة السابقة' });
    const next = screen.getByRole('button', { name: 'الصفحة التالية' });
    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(next);
    expect(screen.getByText('الصفحة 2 / 2')).toBeTruthy();
    expect((previous as HTMLButtonElement).disabled).toBe(false);
    expect((next as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(previous);
    expect(screen.getByText('الصفحة 1 / 2')).toBeTruthy();
    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps incremental visibility state and scrolls only to bounded page targets', async () => {
    render(<OriginalPdfReader fileId="file-navigation" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());

    const pageOneElement = document.querySelector('[data-page-num="1"]');
    const pageTwoElement = document.querySelector('[data-page-num="2"]');
    expect(pageOneElement).toBeTruthy();
    expect(pageTwoElement).toBeTruthy();
    await waitFor(() => expect(intersectionObserver).toBeTruthy());

    await act(async () => {
      intersectionObserver?.notify([intersectionEntry(pageOneElement!, 1)]);
      intersectionObserver?.notify([intersectionEntry(pageTwoElement!, 0.6)]);
    });
    expect(screen.getByText('Page 1 / 2')).toBeTruthy();

    const pageOneScroll = vi.fn();
    const pageTwoScroll = vi.fn();
    Object.defineProperty(pageOneElement, 'scrollIntoView', { configurable: true, value: pageOneScroll });
    Object.defineProperty(pageTwoElement, 'scrollIntoView', { configurable: true, value: pageTwoScroll });

    const previous = screen.getByRole('button', { name: 'Previous Page' });
    const next = screen.getByRole('button', { name: 'Next Page' });
    fireEvent.click(previous);
    expect(pageOneScroll).not.toHaveBeenCalled();

    fireEvent.click(next);
    expect(pageTwoScroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(screen.getByText('Page 2 / 2')).toBeTruthy();
    fireEvent.click(next);
    expect(pageTwoScroll).toHaveBeenCalledTimes(1);

    fireEvent.click(previous);
    expect(pageOneScroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(screen.getByText('Page 1 / 2')).toBeTruthy();
  });

  it('rejects HTTP errors without invoking PDF.js and retries through the authenticated path', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(401));
    render(<OriginalPdfReader fileId="file-http-error" label="Original PDF" labels={defaultLabels} />);

    await waitFor(() => expect(screen.getByText('Failed to load PDF')).toBeTruthy());
    expect(getDocument).not.toHaveBeenCalled();
    const fetchesBeforeRetry = mockedFetch.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());
    expect(mockedFetch).toHaveBeenCalledTimes(fetchesBeforeRetry + 1);
  });

  it('rejects an invalid PDF signature before PDF.js receives the response', async () => {
    mockedFetch.mockResolvedValueOnce(pdfResponse('not-a-pdf'));
    render(<OriginalPdfReader fileId="file-invalid" label="Original PDF" labels={defaultLabels} />);

    await waitFor(() => expect(screen.getByText('Failed to load PDF')).toBeTruthy());
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('maps an unexpected PDF.js failure to a safe visible alert', async () => {
    loadingTask = { promise: Promise.reject(new Error('private parser detail')), destroy: destroyLoadingTask };
    getDocument.mockReturnValueOnce(loadingTask);
    render(<OriginalPdfReader fileId="file-parser-error" label="Original PDF" labels={defaultLabels} />);

    await waitFor(() => expect(screen.getByText('Failed to load PDF')).toBeTruthy());
    expect(screen.queryByText('private parser detail')).toBeNull();
    expect(destroyLoadingTask).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:studyai-pdf-reader');
  });

  it('does not create a loading task when cleanup occurs while the runtime import is pending', async () => {
    const runtimeDeferred = deferred<PdfJsRuntime>();
    mockedLoadRuntime.mockReturnValueOnce(runtimeDeferred.promise);
    const view = render(<OriginalPdfReader fileId="file-pending-runtime" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));

    view.unmount();
    await act(async () => runtimeDeferred.resolve(runtime));

    expect(getDocument).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:studyai-pdf-reader');
  });

  it('destroys the owned loading task and revokes the object URL after resolution on unmount', async () => {
    const view = render(<OriginalPdfReader fileId="file-cleanup" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());
    await waitFor(() => {
      expect(renderPageOne).toHaveBeenCalled();
      expect(renderPageTwo).toHaveBeenCalled();
    });

    view.unmount();

    expect(destroyLoadingTask).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:studyai-pdf-reader');
    expect(pageOneRenderTask.cancel).toHaveBeenCalled();
    expect(pageTwoRenderTask.cancel).toHaveBeenCalled();
  });

  it('cancels obsolete render tasks when zoom changes and ignores cancellation failures', async () => {
    const cancelled = Promise.reject(Object.assign(new Error('cancelled'), { name: 'RenderingCancelledException' }));
    cancelled.catch(() => undefined);
    pageOneRenderTask = { promise: cancelled, cancel: vi.fn() };
    renderPageOne.mockImplementation(() => pageOneRenderTask);
    render(<OriginalPdfReader fileId="file-render-cancel" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());
    await waitFor(() => expect(renderPageOne).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }));
    await waitFor(() => expect(pageOneRenderTask.cancel).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a safe page-level alert when rendering fails unexpectedly', async () => {
    const failed = Promise.reject(new Error('render internals'));
    failed.catch(() => undefined);
    pageTwoRenderTask = { promise: failed, cancel: vi.fn() };
    renderPageTwo.mockImplementation(() => pageTwoRenderTask);
    render(<OriginalPdfReader fileId="file-render-error" label="Original PDF" labels={defaultLabels} />);

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(screen.getByText('Failed to load PDF')).toBeTruthy();
    expect(screen.queryByText('render internals')).toBeNull();
  });

  it('survives React Strict Mode setup and cleanup without a stale failure', async () => {
    render(
      <StrictMode>
        <OriginalPdfReader fileId="file-strict" label="Original PDF" labels={defaultLabels} />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());
    expect(screen.queryByText('Failed to load PDF')).toBeNull();
    expect(mockedFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('prevents a stale load failure from overwriting a newer document success', async () => {
    const staleDocument = deferred<PdfDocumentProxy>();
    const staleDestroy = vi.fn(() => Promise.resolve());
    const staleTask: PdfDocumentLoadingTask = { promise: staleDocument.promise, destroy: staleDestroy };
    getDocument.mockReturnValueOnce(staleTask).mockReturnValueOnce(loadingTask);

    const view = render(<OriginalPdfReader fileId="old-file" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(1));
    view.rerender(<OriginalPdfReader fileId="new-file" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());

    await act(async () => staleDocument.reject(new Error('stale private failure')));
    expect(screen.queryByText('Failed to load PDF')).toBeNull();
    expect(staleDestroy).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith('/files/new-file/original', expect.any(Object));
  });

  it('releases the first document and loads a changed document identity', async () => {
    const firstDestroy = vi.fn(() => Promise.resolve());
    getDocument.mockReturnValueOnce({ promise: Promise.resolve(pdfDocument), destroy: firstDestroy });
    const view = render(<OriginalPdfReader fileId="file-one" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());

    view.rerender(<OriginalPdfReader fileId="file-two" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('/files/file-two/original', expect.any(Object)));
    expect(firstDestroy).toHaveBeenCalledTimes(1);
  });

  it('supports Original/Extracted mode-style unmount and remount cleanup', async () => {
    const firstView = render(<OriginalPdfReader fileId="file-mode" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());
    firstView.unmount();
    expect(destroyLoadingTask).toHaveBeenCalledTimes(1);

    render(<OriginalPdfReader fileId="file-mode" label="Original PDF" labels={defaultLabels} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
