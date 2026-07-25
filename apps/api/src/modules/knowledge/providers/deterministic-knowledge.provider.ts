import { Injectable } from '@nestjs/common';
import { KnowledgeExtractionProvider, KnowledgeExtractionContext } from '../contracts/knowledge-extraction-provider';
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../contracts/knowledge-graph';
import { SemanticChunk } from '../../rag/chunking/contracts/semantic-chunk';
import * as crypto from 'crypto';

@Injectable()
export class DeterministicKnowledgeProvider implements KnowledgeExtractionProvider {
  readonly name = 'DeterministicKnowledgeProvider';

  async extractFromChunks(chunks: SemanticChunk[], context: KnowledgeExtractionContext): Promise<Partial<KnowledgeGraph>> {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    // Simple deterministic extraction rules
    for (const chunk of chunks) {
      // 1. Create a structural node for the chunk itself if it's substantial
      const baseNodeId = `node-${chunk.chunkId}`;
      const conceptLabel = Object.keys(chunk.headingHierarchy).length > 0 
        ? chunk.headingHierarchy[Math.max(...Object.keys(chunk.headingHierarchy).map(Number))] 
        : `Concept from chunk ${chunk.chunkOrder}`;
        
      const baseNode: KnowledgeNode = {
        id: baseNodeId,
        type: 'Concept',
        label: conceptLabel,
        content: chunk.plainText,
        sourceChunkId: chunk.chunkId,
        confidenceScore: 1.0, // Deterministic extraction has 1.0 confidence
        version: '1',
      };
      
      nodes.push(baseNode);

      // 2. Extract definitions deterministically (naive regex: "Term: Definition" or "Term - Definition")
      const defRegex = /^([A-Z][a-zA-Z0-9\s]+?)\s*(?:[:\-])\s*(.+)$/gm;
      let match;
      while ((match = defRegex.exec(chunk.plainText)) !== null) {
        if (match[1].length < 50 && match[2].length > 10) {
          const term = match[1].trim();
          const definition = match[2].trim();
          
          const termNodeId = `term-${crypto.createHash('md5').update(term).digest('hex')}`;
          const defNodeId = `def-${crypto.createHash('md5').update(definition).digest('hex')}`;

          nodes.push({
            id: termNodeId,
            type: 'Term',
            label: term,
            content: term,
            sourceChunkId: chunk.chunkId,
            confidenceScore: 0.9,
            version: '1',
          });

          nodes.push({
            id: defNodeId,
            type: 'Definition',
            label: `Definition of ${term}`,
            content: definition,
            sourceChunkId: chunk.chunkId,
            confidenceScore: 0.9,
            version: '1',
          });

          edges.push({
            sourceNodeId: defNodeId,
            targetNodeId: termNodeId,
            type: 'DEFINES',
            confidenceScore: 0.9,
          });

          // Link to base concept
          edges.push({
            sourceNodeId: termNodeId,
            targetNodeId: baseNodeId,
            type: 'DEPENDS_ON',
            confidenceScore: 0.8,
          });
        }
      }
    }

    return { nodes, edges };
  }

  async enrichGraph(graph: KnowledgeGraph, context: KnowledgeExtractionContext): Promise<KnowledgeGraph> {
    // Deterministic provider does no semantic enrichment.
    return graph;
  }
}
