'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import {
  loadPdfJsRuntime,
  PdfDocumentLoadingTask,
  PdfDocumentProxy,
  PdfPageProxy,
  PdfRenderTask,
} from '../../lib/pdfjs-runtime';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useLocale } from '../../hooks/use-locale';

interface OriginalPdfReaderProps {
  fileId: string;
  label: string;
  labels: {
    loading: string;
    failed: string;
    missing: string;
    invalid: string;
    retry: string;
    previous: string;
    next: string;
    zoomIn: string;
    zoomOut: string;
    fitWidth: string;
    page: string;
  };
}

type PdfFailureKind = 'unavailable' | 'missing' | 'invalid';

class PdfLoadError extends Error {
  constructor(public readonly kind: PdfFailureKind) {
    super(kind);
    this.name = 'PdfLoadError';
  }
}

export function OriginalPdfReader({ fileId, label, labels }: OriginalPdfReaderProps) {
  const { dir } = useLocale();
  const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxy | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [failureKind, setFailureKind] = useState<PdfFailureKind>('unavailable');
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isFitWidth, setIsFitWidth] = useState<boolean>(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingTaskRef = useRef<PdfDocumentLoadingTask | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  
  // Track resizing to update fit-width
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Support ResizeObserver if available
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          setContainerWidth(entries[0].contentRect.width);
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    } else {
      // Fallback
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, [status]);

  const releasePdfResources = useCallback(() => {
    const loadingTask = loadingTaskRef.current;
    loadingTaskRef.current = null;
    if (loadingTask) {
      void loadingTask.destroy().catch(() => undefined);
    }

    const objectUrl = objectUrlRef.current;
    objectUrlRef.current = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, []);

  const loadDocument = useCallback(async () => {
    setStatus('loading');
    setFailureKind('unavailable');
    setPdfDoc(null);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    releasePdfResources();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      const response = await authenticatedFetch(`/files/${fileId}/original`, {
        signal: abortController.signal,
      });
      
      if (!response.ok) {
        throw new PdfLoadError(response.status === 404 ? 'missing' : 'unavailable');
      }
      
      const blob = await response.blob();
      const signature = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
      if (signature !== '%PDF-') {
        throw new PdfLoadError('invalid');
      }
      if (abortController.signal.aborted) return;

      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      
      const pdfjs = await loadPdfJsRuntime();
      if (abortController.signal.aborted) return;
      
      const loadingTask = pdfjs.getDocument({
        url: objectUrl,
        isEvalSupported: false,
      });
      loadingTaskRef.current = loadingTask;
      
      let doc: PdfDocumentProxy;
      try {
        doc = await loadingTask.promise;
      } catch {
        throw new PdfLoadError('invalid');
      }
      if (abortController.signal.aborted) return;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setStatus('success');
      
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : '';
      if (!abortController.signal.aborted && errorName !== 'AbortError') {
        releasePdfResources();
        setFailureKind(error instanceof PdfLoadError ? error.kind : 'unavailable');
        setStatus('error');
      }
    }
  }, [fileId, releasePdfResources]);

  useEffect(() => {
    loadDocument();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      releasePdfResources();
    };
  }, [loadDocument, releasePdfResources]);

  const handleZoomIn = () => {
    setIsFitWidth(false);
    setScale(s => Math.min(s + 0.25, 3.0));
  };
  
  const handleZoomOut = () => {
    setIsFitWidth(false);
    setScale(s => Math.max(s - 0.25, 0.5));
  };
  
  const handleFitWidth = () => {
    setIsFitWidth(true);
  };
  
  const scrollToPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    const element = pageRefs.current[pageNum - 1];
    if (element && containerRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      scrollToPage(currentPage + 1);
    }
  };

  useEffect(() => {
    if (status !== 'success' || typeof IntersectionObserver === 'undefined') return;

    const visibleRatios = new Map<Element, number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        visibleRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      });

      const mostVisiblePage = pageRefs.current.reduce<HTMLDivElement | null>((best, page) => {
        if (!page || (visibleRatios.get(page) ?? 0) <= (best ? visibleRatios.get(best) ?? 0 : 0)) {
          return best;
        }
        return page;
      }, null);

      if (mostVisiblePage) {
        const pageNumStr = mostVisiblePage.getAttribute('data-page-num');
        if (pageNumStr) {
          setCurrentPage(parseInt(pageNumStr, 10));
        }
      }
    }, {
      root: containerRef.current,
      threshold: 0.1,
    });
    
    const currentRefs = pageRefs.current;
    currentRefs.forEach(ref => {
      if (ref) observer.observe(ref);
    });
    
    return () => {
      currentRefs.forEach(ref => {
        if (ref) observer.unobserve(ref);
      });
      observer.disconnect();
    };
  }, [status, numPages]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-border bg-muted/30" role="status" aria-busy="true">
        <Spinner className="mb-4 h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-6 text-center" role="alert">
        <AlertCircle className="mb-4 h-10 w-10 text-destructive" />
        <p className="mb-4 font-medium text-foreground">
          {failureKind === 'missing'
            ? labels.missing
            : failureKind === 'invalid' ? labels.invalid : labels.failed}
        </p>
        <Button onClick={() => loadDocument()} variant="outline" size="sm">
          {labels.retry}
        </Button>
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-border bg-muted/30" role="status" aria-busy="true">
        <Spinner className="mb-4 h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/60 p-2" dir={dir}>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            aria-label={labels.previous}
            title={labels.previous}
          >
            {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          
          <span className="mx-2 text-sm font-medium text-foreground tabular-nums">
            {labels.page} {currentPage} / {numPages}
          </span>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            aria-label={labels.next}
            title={labels.next}
          >
            {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomOut} 
            disabled={scale <= 0.5}
            aria-label={labels.zoomOut}
            title={labels.zoomOut}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="min-w-[3rem] text-center text-sm font-medium text-foreground tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleZoomIn} 
            disabled={scale >= 3.0}
            aria-label={labels.zoomIn}
            title={labels.zoomIn}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          
          <Button 
            variant={isFitWidth ? 'secondary' : 'ghost'} 
            size="icon" 
            onClick={handleFitWidth}
            aria-label={labels.fitWidth}
            title={labels.fitWidth}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="min-h-[500px] flex-1 overflow-auto bg-muted/40 p-4"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
        dir="ltr"
      >
        <div className="flex flex-col items-center gap-6 mx-auto">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <PdfPage 
              key={pageNum}
              pdfDoc={pdfDoc}
              pageNum={pageNum}
              scale={scale}
              isFitWidth={isFitWidth}
              containerWidth={containerWidth}
              failureLabel={labels.failed}
              pageRef={(el) => {
                pageRefs.current[pageNum - 1] = el;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PdfPageProps {
  pdfDoc: PdfDocumentProxy;
  pageNum: number;
  scale: number;
  isFitWidth: boolean;
  containerWidth: number;
  failureLabel: string;
  pageRef: (el: HTMLDivElement | null) => void;
}

function PdfPage({ pdfDoc, pageNum, scale, isFitWidth, containerWidth, failureLabel, pageRef }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<PdfRenderTask | null>(null);
  const [page, setPage] = useState<PdfPageProxy | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setRenderFailed(false);
    void pdfDoc.getPage(pageNum).then((loadedPage) => {
      if (active) setPage(loadedPage);
    }).catch(() => {
      if (active) {
        setPage(null);
        setRenderFailed(true);
      }
    });
    return () => { active = false; };
  }, [pdfDoc, pageNum]);

  const computedScale = useMemo(() => {
    if (!page) return scale;
    
    if (isFitWidth && containerWidth > 0) {
      const targetWidth = containerWidth - 48; // Padding
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      return targetWidth / unscaledViewport.width;
    }
    
    return scale;
  }, [page, scale, isFitWidth, containerWidth]);

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    let active = true;
    setRenderFailed(false);
    
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }
    
    const viewport = page.getViewport({ scale: computedScale });
    
    setDimensions({ width: viewport.width, height: viewport.height });
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const outputScale = window.devicePixelRatio || 1;
    
    canvas.width = viewport.width * outputScale;
    canvas.height = viewport.height * outputScale;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    
    ctx.scale(outputScale, outputScale);
    
    const task = page.render({
      canvasContext: ctx,
      viewport,
    });
    
    renderTaskRef.current = task;
    
    void task.promise.catch((error: unknown) => {
      const errorName = error instanceof Error ? error.name : '';
      if (active && errorName !== 'RenderingCancelledException') setRenderFailed(true);
    });
    
    return () => {
      active = false;
      task.cancel();
      if (renderTaskRef.current === task) renderTaskRef.current = null;
    };
  }, [page, computedScale]);

  return (
    <div 
      ref={pageRef} 
      data-page-num={pageNum}
      className="relative bg-white shadow-xl max-w-full overflow-hidden"
      style={{
        width: dimensions.width ? `${dimensions.width}px` : 'auto',
        height: dimensions.height ? `${dimensions.height}px` : 'auto',
        minWidth: dimensions.width ? 'auto' : '300px',
        minHeight: dimensions.height ? 'auto' : '400px',
      }}
    >
      <canvas 
        ref={canvasRef} 
        dir="ltr"
        className="block"
      />
      {renderFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-foreground" role="alert">
          {failureLabel}
        </div>
      )}
    </div>
  );
}
