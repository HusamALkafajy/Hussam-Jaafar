const PDFJS_RUNTIME_URL = '/vendor/pdfjs/pdf.mjs';
const PDFJS_WORKER_URL = '/vendor/pdfjs/pdf.worker.mjs';

export interface PdfViewport {
  readonly width: number;
  readonly height: number;
}

export interface PdfRenderTask {
  readonly promise: Promise<void>;
  cancel(): void;
}

export interface PdfPageProxy {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): PdfRenderTask;
}

export interface PdfDocumentProxy {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
}

export interface PdfDocumentLoadingTask {
  readonly promise: Promise<PdfDocumentProxy>;
  destroy(): Promise<void>;
}

export interface PdfJsRuntime {
  readonly GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: {
    data?: Uint8Array;
    url?: string;
    isEvalSupported: false;
  }): PdfDocumentLoadingTask;
}

let runtimePromise: Promise<PdfJsRuntime> | undefined;

export function isPdfJsRuntime(value: unknown): value is PdfJsRuntime {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    readonly GlobalWorkerOptions?: unknown;
    readonly getDocument?: unknown;
  };
  const workerOptions = candidate.GlobalWorkerOptions;
  const hasWorkerOptions = workerOptions !== null
    && (typeof workerOptions === 'object' || typeof workerOptions === 'function')
    && 'workerSrc' in workerOptions;

  return typeof candidate.getDocument === 'function'
    && hasWorkerOptions;
}

export function loadPdfJsRuntime(): Promise<PdfJsRuntime> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PDF.js can only be loaded in a browser.'));
  }

  if (!runtimePromise) {
    const runtimeUrl = PDFJS_RUNTIME_URL;
    runtimePromise = import(/* webpackIgnore: true */ runtimeUrl)
      .then((module: unknown) => {
        if (!isPdfJsRuntime(module)) {
          throw new Error('The generated PDF.js browser runtime has an unexpected shape.');
        }
        module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return module;
      })
      .catch((error: unknown) => {
        runtimePromise = undefined;
        throw error;
      });
  }

  return runtimePromise;
}
