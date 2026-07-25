import { StructuralBlock } from '@studyai/ast';

export interface SemanticChunk {
  chunkId: string;
  chunkHash: string;
  parentChunkId: string | null;
  documentId: string;
  chunkOrder: number;
  sectionPath: string[];
  headingHierarchy: Record<number, string>;
  blockReferences: number[];
  plainText: string;
  chunkContent: StructuralBlock[];
  structuralMetadata: Record<string, any>;
  estimatedTokens: number;
  previousChunkId: string | null;
  nextChunkId: string | null;
}
