import { Injectable, Logger } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { KnowledgeGraphBuilder } from '../knowledge/knowledge-graph.builder';
import { TutorEvidence } from './contracts/tutor-evidence';
import { KnowledgeEvidenceAssembler } from '../knowledge/providers/knowledge-evidence-assembler';

@Injectable()
export class RetrievalOrchestrator {
  private readonly logger = new Logger(RetrievalOrchestrator.name);

  constructor(
    private readonly ragService: RagService,
    private readonly evidenceAssembler: KnowledgeEvidenceAssembler,
  ) {}

  async gatherEvidence(
    documentId: string,
    versionId: string,
    query: string,
  ): Promise<TutorEvidence> {
    this.logger.log(`Gathering evidence for query: "${query}" (version: ${versionId})`);
    const evidence = await this.evidenceAssembler.assembleEvidence(documentId, versionId, query);
    
    // Ensure the semantic chunks fit the TutorEvidence subtype
    const semanticChunksEvidence = evidence.semanticChunks.map(c => ({
      chunkId: c.chunkId,
      content: c.content,
      page: c.page,
      relevanceScore: c.relevanceScore,
    }));

    return {
      ...evidence,
      semanticChunks: semanticChunksEvidence,
      citations: [], // Populated by context builder if needed
    };

    return evidence;
  }
}
