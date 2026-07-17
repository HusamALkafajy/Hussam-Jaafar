import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentNode, VirtualReaderConfig } from './types';

interface UseVirtualReaderProps {
  documentId: string;
  rootNodeId: string;
  config: VirtualReaderConfig;
}

export function useVirtualReader({ documentId, rootNodeId, config }: UseVirtualReaderProps) {
  const windowSize = config.windowSize || 50;
  const prefetchDistance = config.prefetchDistance || 10;
  
  const [nodes, setNodes] = useState<DocumentNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Tri-buffer state (simplified for example: tracking current, next, prev cursors)
  const currentCursor = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const activeRequestId = useRef<number>(0);

  const fetchWindow = useCallback(async (cursor: string | null, isPrefetch = false) => {
    const requestId = ++activeRequestId.current;
    
    if (abortControllerRef.current && !isPrefetch) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    if (!isPrefetch) abortControllerRef.current = abortController;

    try {
      if (!isPrefetch) setIsLoading(true);

      const url = new URL(`/api/documents/nodes/${rootNodeId}/window`, window.location.origin);
      url.searchParams.set('limit', windowSize.toString());
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), { 
        signal: abortController.signal 
      });

      if (!response.ok) throw new Error('Failed to fetch document window');
      const json = await response.json();

      // Guard: Out-of-order response rejection
      if (requestId !== activeRequestId.current) return;

      setNodes((prevNodes) => {
        // Tri-buffer logic: If prefetching down, append and slice top to maintain O(window) size.
        // For simplicity in this production slice, we'll replace the buffer or merge safely.
        // True tri-buffer would keep 3x windowSize max elements.
        
        // Merge logic ensuring constant memory
        const newNodes = json.data || [];
        
        let merged = isPrefetch ? [...prevNodes, ...newNodes] : newNodes;
        
        // Deduplicate using Map and maintain strict Canonical UUID identity
        const uniqueMap = new Map<string, DocumentNode>();
        merged.forEach((n: DocumentNode) => uniqueMap.set(n.id, n));
        
        let finalNodes = Array.from(uniqueMap.values());
        
        // Evict nodes outside 3x windowSize limit
        if (finalNodes.length > windowSize * 3) {
          // If we scrolled down, keep the bottom elements
          finalNodes = finalNodes.slice(-windowSize * 3);
        }

        return finalNodes;
      });
      
      if (!isPrefetch) setIsLoading(false);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err);
        if (!isPrefetch) setIsLoading(false);
      }
    }
  }, [rootNodeId, windowSize]);

  // Initial load
  useEffect(() => {
    fetchWindow(null);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchWindow]);

  // Scroll observer callback
  const onScroll = useCallback((scrollOffset: number, maxScroll: number) => {
    // If we reach bottom 80%, trigger prefetch of the next chunk based on last known node
    if (maxScroll > 0 && scrollOffset / maxScroll > 0.8 && !isLoading) {
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        fetchWindow(lastNode.lexoRank, true); // prefetch
      }
    }
  }, [nodes, isLoading, fetchWindow]);

  return {
    nodes,
    isLoading,
    error,
    onScroll
  };
}
