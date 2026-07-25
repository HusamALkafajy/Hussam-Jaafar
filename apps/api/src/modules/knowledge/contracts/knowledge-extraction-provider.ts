import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from './knowledge-graph';
import { SemanticChunk } from '../../rag/chunking/contracts/semantic-chunk';

export interface KnowledgeExtractionContext {
  documentId: string;
  graphVersion: string;
}

export interface KnowledgeExtractionProvider {
  /**
   * The name of the provider for telemetry and logging.
   */
  readonly name: string;

  /**
   * Extracts initial nodes and edges directly from semantic chunks.
   * This is typically the deterministic first-pass.
   */
  extractFromChunks(chunks: SemanticChunk[], context: KnowledgeExtractionContext): Promise<Partial<KnowledgeGraph>>;

  /**
   * Enriches an existing graph by discovering implicit relationships,
   * new concepts, or improving confidence scores.
   */
  enrichGraph(graph: KnowledgeGraph, context: KnowledgeExtractionContext): Promise<KnowledgeGraph>;
}
