import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentNode, VirtualReaderConfig } from './types';

interface UseVirtualReaderProps {
  versionId: string | null;
  rootNodeId: string;
  config: VirtualReaderConfig;
}

export function useVirtualReader({ versionId, rootNodeId, config }: UseVirtualReaderProps) {
  const windowSize = config.windowSize || 50;
  const prefetchDistance = config.prefetchDistance || 10;
  
  const [nodes, setNodes] = useState<DocumentNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestId = useRef<number>(0);

  const fetchWindow = useCallback(async (cursor: string | null, isPrefetch = false) => {
    // Guard: do not fire a request if versionId or rootNodeId is not yet available
    if (!versionId || !rootNodeId) {
      setIsLoading(false);
      return;
    }

    const requestId = ++activeRequestId.current;
    
    if (abortControllerRef.current && !isPrefetch) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    if (!isPrefetch) abortControllerRef.current = abortController;

    try {
      if (!isPrefetch) setIsLoading(true);

      const url = new URL(`/api/documents/versions/${versionId}/nodes/${rootNodeId}/window`, window.location.origin);
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
        const newNodes = json.data || [];
        let merged = isPrefetch ? [...prevNodes, ...newNodes] : newNodes;
        
        const uniqueMap = new Map<string, DocumentNode>();
        merged.forEach((n: DocumentNode) => uniqueMap.set(n.id, n));
        
        let finalNodes = Array.from(uniqueMap.values());
        
        if (finalNodes.length > windowSize * 3) {
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
  }, [versionId, rootNodeId, windowSize]);

  useEffect(() => {
    fetchWindow(null);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchWindow]);

  const onScroll = useCallback((scrollOffset: number, maxScroll: number) => {
    if (maxScroll > 0 && scrollOffset / maxScroll > 0.8 && !isLoading) {
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        fetchWindow(lastNode.lexoRank, true);
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
