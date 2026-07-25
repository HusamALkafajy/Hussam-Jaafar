import { Injectable, Logger } from '@nestjs/common';
import { AssetGenerator } from '../../learning-assets/contracts/asset-generator';
import { AssetType, LearningAsset } from '../../learning-assets/contracts/learning-asset';
import { KnowledgeGraph } from '../../knowledge/contracts/knowledge-graph';
import { QuizQuestionAsset } from './contracts/quiz';
import { QuizEngine } from './quiz.engine';
import { QuizzesRepository } from '../quizzes.repository';
import { EventBusService } from '../../events/event-bus.service';
import { QuizGeneratedEvent } from '../../events/domain-event';
import { KnowledgeEvidenceAssembler } from '../../knowledge/providers/knowledge-evidence-assembler';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QuizGenerator implements AssetGenerator<QuizQuestionAsset> {
  readonly assetType: AssetType = 'QuizQuestion';
  private readonly logger = new Logger(QuizGenerator.name);
  private readonly engine = new QuizEngine();

  constructor(
    private readonly repository: QuizzesRepository,
    private readonly eventBus: EventBusService,
    private readonly assembler: KnowledgeEvidenceAssembler,
  ) {}

  async generatePayloads(graph: KnowledgeGraph, context?: any): Promise<QuizQuestionAsset[]> {
    const versionId = graph.metadata?.version;
    const documentId = graph.metadata?.documentId || context?.documentId;

    if (!versionId || !documentId) {
      return [];
    }

    const evidence = await this.assembler.assembleEvidence(documentId, versionId);
    if (!evidence || !evidence.graph) {
      return [];
    }

    return this.engine.generateQuestions(evidence);
  }

  validatePayload(payload: QuizQuestionAsset): boolean {
    if (!payload.front || !payload.back || !payload.type) {
      return false;
    }
    if (payload.type === 'mcq' && (!payload.options || payload.options.length < 2)) {
      return false;
    }
    return true;
  }

  mapToAsset(payload: QuizQuestionAsset, graph: KnowledgeGraph): LearningAsset<QuizQuestionAsset> {
    return {
      assetId: payload.quizQuestionId,
      assetType: this.assetType,
      originGraphVersion: payload.originGraphVersion,
      sourceNodeIds: [payload.knowledgeNodeId],
      sourceEdgeIds: [],
      difficulty: 0.5,
      confidenceScore: 0.9,
      language: graph.metadata.language || 'en',
      tags: [],
      version: payload.version,
      createdAt: new Date(),
      payload,
    };
  }

  async persist(assets: LearningAsset<QuizQuestionAsset>[], context: any): Promise<void> {
    if (assets.length === 0) {
      this.logger.log(`No quiz questions generated for document ${context.documentId}`);
      return;
    }

    const title = `Quiz for document ${context.documentId}`;

    // 1. Dual-write Atomicity constraint: Any failure to persist must block the emission of domain events
    try {
      await this.repository.persistQuiz(
        context.documentId,
        context.userId,
        title,
        assets[0].originGraphVersion,
        assets
      );

      this.logger.log(`Successfully persisted ${assets.length} quiz questions for ${context.documentId}`);

      // 2. Publish QuizGenerated event to the local EventBus
      const eventId = uuidv4();
      const quizEvent = new QuizGeneratedEvent(eventId, context.documentId, {
        quizId: context.documentId, // We don't have the exact examId returned from persist right now, we can pass documentId
        fileId: context.documentId
      });
      
      await this.eventBus.publish(quizEvent);
      this.logger.log(`Published QuizGenerated event for document ${context.documentId}`);

    } catch (error) {
      this.logger.error(`Failed to persist quiz questions for ${context.documentId}. Event emission blocked.`, error);
      throw error; // Let the LearningAssetPipeline handle the failure
    }
  }
}
