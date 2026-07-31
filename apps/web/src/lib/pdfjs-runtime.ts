const PDFJS_RUNTIME_URL = '/vendor/pdfjs/pdf.mjs';
const PDFJS_WORKER_URL = '/vendor/pdfjs/pdf.worker.mjs';

interface PdfDocumentProxy {
  readonly numPages: number;
  destroy(): Promise<void>;
  getPage(pageNumber: number): Promise<unknown>;
}

interface PdfJsRuntime {
  readonly GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: {
    data: Uint8Array;
    isEvalSupported: false;
  }): { promise: Promise<PdfDocumentProxy> };
}

let runtimePromise: Promise<PdfJsRuntime> | undefined;

function isPdfJsRuntime(value: unknown): value is PdfJsRuntime {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PdfJsRuntime>;
  return typeof candidate.getDocument === 'function'
    && typeof candidate.GlobalWorkerOptions === 'object'
    && candidate.GlobalWorkerOptions !== null;
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
