import { Injectable } from '@nestjs/common';
import { AssetGenerator } from '../../learning-assets/contracts/asset-generator';
import { AssetType, LearningAsset } from '../../learning-assets/contracts/learning-asset';
import { KnowledgeGraph } from '../../knowledge/contracts/knowledge-graph';
import { FlashcardEngine } from './flashcard.engine';
import { Flashcard } from './contracts/flashcard';
import { FlashcardsRepository } from '../flashcards.repository';
import { KnowledgeGraphConsumer } from '../../knowledge/providers/knowledge-graph-consumer';

@Injectable()
export class FlashcardGenerator implements AssetGenerator<Flashcard> {
  readonly assetType: AssetType = 'Flashcard';

  constructor(
    private readonly flashcardEngine: FlashcardEngine,
    private readonly repository: FlashcardsRepository,
    private readonly consumer: KnowledgeGraphConsumer,
  ) {}

  async generatePayloads(graph: KnowledgeGraph): Promise<Flashcard[]> {
    const versionId = graph.metadata?.version;
    if (!versionId) {
      return [];
    }

    // 1. Retrieve Persistent Knowledge Graph
    const persistentGraph = await this.consumer.resolveGraph(versionId);

    if (!persistentGraph) {
      // Controlled fallback: detect explicitly, never regenerate silently
      return [];
    }

    // 2. Related Semantic Chunks & 3. Supporting Metadata
    // The persistent Knowledge Graph implicitly provides the topological metadata
    // required for deterministic flashcard generation.

    // The engine handles the deterministic mapping and deduplication
    return this.flashcardEngine.generateCards(persistentGraph);
  }

  validatePayload(payload: Flashcard): boolean {
    // The engine already validated it during generation, but we can do a secondary check
    return !!payload.front && !!payload.back && !!payload.knowledgeNodeId;
  }

  mapToAsset(payload: Flashcard, graph: KnowledgeGraph): LearningAsset<Flashcard> {
    return {
      assetId: payload.flashcardId,
      assetType: this.assetType,
      originGraphVersion: payload.originGraphVersion,
      sourceNodeIds: [payload.knowledgeNodeId],
      sourceEdgeIds: [],
      difficulty: payload.difficulty || 0.5,
      confidenceScore: payload.confidenceScore,
      language: 'en', // Note: Hardcoded to English until multi-language extraction is supported by the graph pipeline.
      tags: payload.tags || [],
      version: payload.version,
      createdAt: payload.createdAt,
      payload: payload
    };
  }

  async persist(assets: LearningAsset<Flashcard>[], context: any): Promise<void> {
    const { fileId, userId } = context;
    if (!fileId || !userId) {
      throw new Error('FlashcardGenerator persist requires fileId and userId in context');
    }
    await this.repository.saveGeneratedFlashcards(fileId, userId, assets);
  }
}
