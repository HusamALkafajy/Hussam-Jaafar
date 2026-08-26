import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeGraphRepository } from '../knowledge-graph.repository';
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../contracts/knowledge-graph';

@Injectable()
export class KnowledgeGraphConsumer {
  private readonly logger = new Logger(KnowledgeGraphConsumer.name);

  constructor(private readonly repository: KnowledgeGraphRepository) {}

  /**
   * Retrieves the persistent Knowledge Graph by version ID.
   * Explicitly handles fallbacks if the graph is missing.
   */
  async resolveGraph(versionId: string): Promise<KnowledgeGraph | null> {
    const graph = await this.repository.getGraphByVersionId(versionId);
    if (!graph) {
      this.logger.warn(`No persistent Knowledge Graph found for version ${versionId}.`);
      return null;
    }
    return graph;
  }

  /**
   * Traverses the graph to extract the highest confidence nodes.
   */
  getTopNodes(graph: KnowledgeGraph, limit: number): KnowledgeNode[] {
    const sortedNodes = [...graph.nodes].sort((a, b) => b.confidenceScore - a.confidenceScore);
    return sortedNodes.slice(0, limit);
  }

  /**
   * Expands relationships for a given set of node IDs, returning the relevant subgraph.
   */
  getSubgraph(graph: KnowledgeGraph, nodeIds: string[]): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    const nodes = graph.nodes.filter(n => nodeIds.includes(n.id));
    const edges = graph.edges.filter(e => nodeIds.includes(e.sourceNodeId) || nodeIds.includes(e.targetNodeId));
    return { nodes, edges };
  }
}
