export interface DocumentNode {
  id: string; // Canonical UUID
  parentId: string | null;
  lexoRank: string;
  nodeType: string;
  content: any;
  metadata: any;
}

export interface VirtualReaderConfig {
  windowSize?: number; // E.g., 50 nodes per window
  prefetchDistance?: number; // How many nodes before boundary to trigger prefetch
  estimatedNodeHeight?: number; // For scrollbar spoofing
}

export interface VirtualReaderProps {
  documentId: string;
  rootNodeId: string;
  config?: VirtualReaderConfig;
  className?: string;
}

export interface CacheWindow {
  cursor: string;
  nodes: DocumentNode[];
  fetchedAt: number;
}
