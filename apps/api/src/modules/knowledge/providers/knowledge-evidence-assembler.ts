import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeGraphConsumer } from './knowledge-graph-consumer';
import { KnowledgeEvidence } from '../contracts/knowledge-evidence';
import { RagService } from '../../rag/rag.service';
import { db, flashcards, questions, flashcardSets, exams, eq, inArray, and } from '@studyai/database';
import { isNotNull } from 'drizzle-orm';
import { LearningAsset } from '../../learning-assets/contracts/learning-asset';
import { Flashcard } from '../../flashcards/engine/contracts/flashcard';
import { QuizQuestionAsset } from '../../quizzes/engine/contracts/quiz';

@Injectable()
export class KnowledgeEvidenceAssembler {
  private readonly logger = new Logger(KnowledgeEvidenceAssembler.name);

  constructor(
    private readonly consumer: KnowledgeGraphConsumer,
    private readonly ragService: RagService,
  ) {}

  /**
   * Constructs the unified educational evidence model by coordinating the Knowledge Graph Consumer,
   * RAG chunks, and database queries for related Flashcards and Quizzes.
   */
  async assembleEvidence(documentId: string, versionId: string, query?: string): Promise<KnowledgeEvidence> {
    this.logger.log(`Assembling Knowledge Evidence for version: ${versionId}`);

    // 1. Retrieve Canonical Knowledge Graph
    const graph = await this.consumer.resolveGraph(versionId);
    
    if (!graph) {
      // Fallback
      return {
        graph: {
          nodes: [],
          edges: [],
          metadata: { 
            version: versionId, 
            originDocumentId: documentId, 
            documentId: documentId,
            entityCount: 0, 
            confidence: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        knowledgeNodes: [],
        relationships: [],
        semanticChunks: [],
        flashcards: [],
        quizzes: [],
        citations: [],
        metadata: {
          documentId,
          originVersion: versionId,
          confidenceScore: 0,
        }
      };
    }

    // 2. Traversal: Get top nodes
    const topNodes = this.consumer.getTopNodes(graph, 10);
    const nodeIds = topNodes.map(n => n.id);
    const subgraph = this.consumer.getSubgraph(graph, nodeIds);

    // 3. Semantic Chunks
    let semanticChunksEvidence: any[] = [];
    let chunkConfidence = 0;
    if (query) {
      const chunksResult = await this.ragService.searchChunks(versionId, query, 5);
      semanticChunksEvidence = chunksResult.map((c, idx) => ({
        chunkId: `chunk-${idx}`,
        content: c.content,
        page: c.pageNumber,
        relevanceScore: c.similarity,
      }));
      if (chunksResult.length > 0) {
        chunkConfidence = chunksResult[0].similarity;
      }
    }

    // 4. Retrieve Flashcards linked to top nodes
    let flashcardAssets: LearningAsset<Flashcard>[] = [];
    if (nodeIds.length > 0) {
      const fcResults = await db.select()
        .from(flashcards)
        .innerJoin(flashcardSets, eq(flashcards.setId, flashcardSets.id))
        .where(
          and(
            eq(flashcardSets.fileId, documentId),
            inArray(flashcards.knowledgeNodeId, nodeIds)
          )
        );

      flashcardAssets = fcResults.map(r => ({
        assetId: r.flashcards.id,
        assetType: 'Flashcard' as const,
        originGraphVersion: r.flashcard_sets.originGraphVersion || versionId,
        sourceNodeIds: r.flashcards.knowledgeNodeId ? [r.flashcards.knowledgeNodeId] : [],
        sourceEdgeIds: [],
        difficulty: 1,
        confidenceScore: 1,
        language: 'en',
        tags: [],
        version: r.flashcards.version || '1',
        createdAt: r.flashcards.createdAt,
        payload: {
          flashcardId: r.flashcards.id,
          knowledgeNodeId: r.flashcards.knowledgeNodeId || '',
          knowledgeNodeVersion: r.flashcards.version || '1',
          originGraphVersion: r.flashcard_sets.originGraphVersion || versionId,
          cardType: r.flashcards.cardType as any,
          front: r.flashcards.front,
          back: r.flashcards.back,
          difficulty: 1,
          confidenceScore: 1,
          tags: [],
          createdAt: r.flashcards.createdAt,
          version: r.flashcards.version || '1',
          sourceReferences: r.flashcards.sourceReferences ? JSON.parse(r.flashcards.sourceReferences) : []
        }
      } as LearningAsset<Flashcard>));
    }

    // 5. Retrieve Quizzes linked to top nodes
    let quizAssets: LearningAsset<QuizQuestionAsset>[] = [];
    if (nodeIds.length > 0) {
      const qResults = await db.select({
          id: questions.id,
          version: questions.version,
          knowledgeNodeId: questions.knowledgeNodeId,
          sourceReferences: questions.sourceReferences,
          type: questions.type,
          difficulty: questions.difficulty,
          questionText: questions.questionText,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          explanation: questions.explanation,
          answeredAt: questions.answeredAt,
      })
        .from(questions)
        .innerJoin(exams, eq(questions.examId, exams.id))
        .where(
          and(
            eq(exams.fileId, documentId),
            isNotNull(questions.knowledgeNodeId),
            inArray(questions.knowledgeNodeId, nodeIds)
          )
        );

      quizAssets = qResults.map(r => ({
        assetId: r.id,
        assetType: 'QuizQuestion' as const,
        originGraphVersion: versionId,
        sourceNodeIds: r.knowledgeNodeId ? [r.knowledgeNodeId] : [],
        sourceEdgeIds: [],
        difficulty: r.difficulty === 'hard' ? 3 : r.difficulty === 'medium' ? 2 : 1,
        confidenceScore: 1,
        language: 'en',
        tags: [],
        version: r.version || '1',
        createdAt: r.answeredAt || new Date(),
        payload: {
          quizQuestionId: r.id,
          knowledgeNodeId: r.knowledgeNodeId || '',
          knowledgeNodeVersion: r.version || '',
          originGraphVersion: versionId,
          type: r.type as any,
          front: r.questionText,
          back: r.correctAnswer,
          options: (r.options as string[]) || [],
          sourceReferences: r.sourceReferences ? JSON.parse(r.sourceReferences) : [],
          version: r.version || '1'
        }
      } as LearningAsset<QuizQuestionAsset>));
    }

    return {
      graph,
      knowledgeNodes: topNodes,
      relationships: subgraph.edges,
      semanticChunks: semanticChunksEvidence,
      flashcards: flashcardAssets,
      quizzes: quizAssets,
      citations: [], // Can be expanded later
      metadata: {
        documentId,
        originVersion: versionId,
        confidenceScore: chunkConfidence,
      }
    };
  }
}
