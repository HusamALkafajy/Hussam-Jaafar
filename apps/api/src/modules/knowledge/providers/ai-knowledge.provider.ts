import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeExtractionProvider, KnowledgeExtractionContext } from '../contracts/knowledge-extraction-provider';
import { KnowledgeGraph } from '../contracts/knowledge-graph';
import { SemanticChunk } from '../../rag/chunking/contracts/semantic-chunk';

@Injectable()
export class AiKnowledgeProvider implements KnowledgeExtractionProvider {
  readonly name = 'AiKnowledgeProvider';
  private readonly logger = new Logger(AiKnowledgeProvider.name);

  // Note: Future ML implementations will inject the AiService dependency here.

  async extractFromChunks(chunks: SemanticChunk[], context: KnowledgeExtractionContext): Promise<Partial<KnowledgeGraph>> {
    // We rely on the deterministic provider for the first pass.
    return { nodes: [], edges: [] };
  }

  async enrichGraph(graph: KnowledgeGraph, context: KnowledgeExtractionContext): Promise<KnowledgeGraph> {
    this.logger.log(`[AiKnowledgeProvider] Enriching graph with ${graph.nodes.length} nodes...`);
    // Note: AI enrichment is intentionally deferred as the current phase enforces deterministic 
    // generation without ML. Future phases will utilize LLMs to infer implicit graph relationships.
    return graph;
  }
}
