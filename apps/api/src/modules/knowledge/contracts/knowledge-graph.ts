export type NodeType = 'Concept' | 'Definition' | 'Rule' | 'Algorithm' | 'Formula' | 'Example' | 'Term';
export type EdgeType = 'DEFINES' | 'EXEMPLIFIES' | 'DEPENDS_ON' | 'PREREQUISITE_OF' | 'EXPLAINS' | 'CONTRADICTS' | 'BELONGS_TO';

export interface KnowledgeNode {
  id: string; // Deterministic ID
  type: NodeType;
  label: string;
  content: string;
  sourceChunkId: string;
  confidenceScore: number;
  version: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeEdge {
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  confidenceScore: number;
}

export interface GraphMetadata {
  documentId: string;
  version: string; // e.g. OriginGraphVersion
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface KnowledgeGraph {
  metadata: GraphMetadata;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}
