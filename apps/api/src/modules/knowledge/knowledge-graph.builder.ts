import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from './contracts/knowledge-graph';
import { KnowledgeExtractionProvider, KnowledgeExtractionContext } from './contracts/knowledge-extraction-provider';
import { SemanticChunk } from '../rag/chunking/contracts/semantic-chunk';

@Injectable()
export class KnowledgeGraphBuilder {
  private readonly logger = new Logger(KnowledgeGraphBuilder.name);

  constructor(
    private readonly primaryProvider: KnowledgeExtractionProvider,
    private readonly enrichmentProviders: KnowledgeExtractionProvider[] = []
  ) {}

  async build(chunks: SemanticChunk[], context: KnowledgeExtractionContext): Promise<KnowledgeGraph> {
    this.logger.log(`[KnowledgeGraphBuilder] Starting build for doc: ${context.documentId}`);

    // 1. Deterministic First Pass
    const initialExtraction = await this.primaryProvider.extractFromChunks(chunks, context);
    
    let graph: KnowledgeGraph = {
      metadata: {
        documentId: context.documentId,
        version: context.graphVersion,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      nodes: initialExtraction.nodes || [],
      edges: initialExtraction.edges || []
    };

    // 2. Optional AI Enrichment
    for (const provider of this.enrichmentProviders) {
      try {
        this.logger.log(`[KnowledgeGraphBuilder] Running enrichment provider: ${provider.name}`);
        graph = await provider.enrichGraph(graph, context);
      } catch (err: any) {
        this.logger.warn(`[KnowledgeGraphBuilder] Enrichment provider ${provider.name} failed (non-fatal): ${err.message}`);
      }
    }

    this.logger.log(`[KnowledgeGraphBuilder] Build complete. Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
    return graph;
  }
}
