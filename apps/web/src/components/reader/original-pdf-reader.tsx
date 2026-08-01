'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { loadPdfJsRuntime } from '../../lib/pdfjs-runtime';
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
    retry: string;
    previous: string;
    next: string;
    zoomIn: string;
    zoomOut: string;
    fitWidth: string;
    page: string;
  };
}

export function OriginalPdfReader({ fileId, label, labels }: OriginalPdfReaderProps) {
  const { dir } = useLocale();
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isFitWidth, setIsFitWidth] = useState<boolean>(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  
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

  const loadDocument = useCallback(async () => {
    setStatus('loading');
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await authenticatedFetch(`/files/${fileId}/original`, {
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch original PDF');
      }
      
      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);
      
      const pdfjs = await loadPdfJsRuntime();
      
      const loadingTask = pdfjs.getDocument({
        data,
        isEvalSupported: false,
      });
      
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setStatus('success');
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setStatus('error');
      }
    }
  }, [fileId]);

  useEffect(() => {
    loadDocument();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setPdfDoc((prev: any) => {
        if (prev) prev.destroy().catch(() => {});
        return null;
      });
    };
  }, [loadDocument]);

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
    
    const observer = new IntersectionObserver((entries) => {
      const visibleEntries = entries.filter(e => e.isIntersecting);
      if (visibleEntries.length > 0) {
        const best = visibleEntries.reduce((prev, current) => 
          (prev.intersectionRatio > current.intersectionRatio) ? prev : current
        );
        
        const pageNumStr = best.target.getAttribute('data-page-num');
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
      <div className="flex flex-col items-center justify-center min-h-[400px] border border-slate-800 rounded-lg bg-slate-950/50" role="status" aria-busy="true">
        <Spinner className="w-8 h-8 text-sky-500 mb-4" />
        <p className="text-slate-400 text-sm">{labels.loading}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] border border-slate-800 rounded-lg bg-slate-950/50" role="alert">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-4" />
        <p className="text-slate-200 font-medium mb-4">{labels.failed}</p>
        <Button onClick={() => loadDocument()} variant="outline" size="sm">
          {labels.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-slate-800 rounded-lg overflow-hidden bg-slate-900" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-slate-800/80 border-b border-slate-700/50" dir={dir}>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={dir === 'rtl' ? handleNextPage : handlePrevPage} 
            disabled={dir === 'rtl' ? currentPage >= numPages : currentPage <= 1}
            aria-label={labels.previous}
            title={labels.previous}
          >
            {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          
          <span className="text-sm font-medium text-slate-300 mx-2 tabular-nums">
            {labels.page} {currentPage} / {numPages}
          </span>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={dir === 'rtl' ? handlePrevPage : handleNextPage} 
            disabled={dir === 'rtl' ? currentPage <= 1 : currentPage >= numPages}
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
          
          <span className="text-sm font-medium text-slate-300 min-w-[3rem] text-center tabular-nums">
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

          <div className="w-px h-4 bg-slate-600 mx-1" aria-hidden="true" />
          
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
        className="flex-1 overflow-auto bg-slate-950 p-4 min-h-[500px]"
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
  pdfDoc: any;
  pageNum: number;
  scale: number;
  isFitWidth: boolean;
  containerWidth: number;
  pageRef: (el: HTMLDivElement | null) => void;
}

function PdfPage({ pdfDoc, pageNum, scale, isFitWidth, containerWidth, pageRef }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderTask, setRenderTask] = useState<any>(null);
  const [page, setPage] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let active = true;
    pdfDoc.getPage(pageNum).then((p: any) => {
      if (active) setPage(p);
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
    
    if (renderTask) {
      renderTask.cancel();
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
    
    setRenderTask(task);
    
    task.promise.catch((err: any) => {
      if (err.name !== 'RenderingCancelledException') {
        console.error(`Page ${pageNum} render error:`, err);
      }
    });
    
    return () => {
      task.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    </div>
  );
}
