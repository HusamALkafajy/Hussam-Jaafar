import { Injectable, Logger } from '@nestjs/common';
import { db, knowledgeNodes, knowledgeEdges } from '@studyai/database';
import { eq, and, inArray } from 'drizzle-orm';
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from './contracts/knowledge-graph';

@Injectable()
export class KnowledgeGraphRepository {
  private readonly logger = new Logger(KnowledgeGraphRepository.name);

  async saveGraph(fileId: string, graph: KnowledgeGraph, versionId?: string): Promise<void> {
    if (graph.nodes.length === 0) return;

    await db.transaction(async (tx) => {
      // Prepare nodes
      const nodeValues = graph.nodes.map(node => ({
        fileId,
        ...(versionId ? { versionId } : {}),
        deterministicHash: node.id, // we map the deterministic hash to the DB column
        nodeType: node.type as any,
        label: node.label,
        content: node.content,
        sourceChunkId: node.sourceChunkId,
        confidenceScore: node.confidenceScore,
        metadata: node.metadata || {},
      }));

      // Insert nodes and returning their generated UUIDs
      const insertedNodes = await tx.insert(knowledgeNodes)
        .values(nodeValues)
        .returning({ id: knowledgeNodes.id, deterministicHash: knowledgeNodes.deterministicHash });

      const nodeHashMap = new Map<string, string>();
      for (const node of insertedNodes) {
        nodeHashMap.set(node.deterministicHash, node.id);
      }

      // Prepare edges
      if (graph.edges.length > 0) {
        const edgeValues = graph.edges
          .filter(edge => nodeHashMap.has(edge.sourceNodeId) && nodeHashMap.has(edge.targetNodeId))
          .map(edge => ({
            sourceNodeId: nodeHashMap.get(edge.sourceNodeId)!,
            targetNodeId: nodeHashMap.get(edge.targetNodeId)!,
            edgeType: edge.type as any,
            confidenceScore: edge.confidenceScore,
          }));

        if (edgeValues.length > 0) {
          // Batch insert edges in chunks to prevent statement size limits if there are many edges
          const chunkSize = 1000;
          for (let i = 0; i < edgeValues.length; i += chunkSize) {
             await tx.insert(knowledgeEdges).values(edgeValues.slice(i, i + chunkSize));
          }
        }
      }
    });
  }

  async getGraphByVersionId(versionId: string): Promise<KnowledgeGraph | null> {
    const nodesRecord = await db.query.knowledgeNodes.findMany({
      where: eq(knowledgeNodes.versionId, versionId)
    });

    if (nodesRecord.length === 0) return null;

    const nodeIds = nodesRecord.map(n => n.id);
    const edgesRecord = await db.query.knowledgeEdges.findMany({
      where: inArray(knowledgeEdges.sourceNodeId, nodeIds)
    });

    const nodeUuidToHash = new Map<string, string>();
    nodesRecord.forEach(n => nodeUuidToHash.set(n.id, n.deterministicHash));

    const nodes: KnowledgeNode[] = nodesRecord.map(n => ({
      id: n.deterministicHash, // Reconstruct the deterministic ID for consumers
      type: n.nodeType as any,
      label: n.label,
      content: n.content,
      sourceChunkId: n.sourceChunkId || '',
      confidenceScore: n.confidenceScore,
      version: '', // We can pass origin version if needed
      metadata: n.metadata as Record<string, any>
    }));

    const edges: KnowledgeEdge[] = edgesRecord.map(e => ({
      sourceNodeId: nodeUuidToHash.get(e.sourceNodeId)!,
      targetNodeId: nodeUuidToHash.get(e.targetNodeId)!,
      type: e.edgeType as any,
      confidenceScore: e.confidenceScore
    }));

    return {
      metadata: {
        documentId: nodesRecord[0].fileId,
        version: versionId,
        createdAt: nodesRecord[0].createdAt,
        updatedAt: nodesRecord[0].createdAt,
      },
      nodes,
      edges
    };
  }
}
