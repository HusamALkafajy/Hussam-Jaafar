import { Injectable, Logger } from '@nestjs/common';
import { db, eq, and, sql } from '@studyai/database';
import { fileProcessingAttempts, files, subjects, documentChunks } from '@studyai/database';
import { FileProcessingExecutionService } from './services/file-processing-execution.service';
import { RagService } from '../rag/rag.service';
import { join } from 'path';
import { TextFallbackExtractor } from './services/extractors/text-fallback.extractor';
import { ErrorClassifier, ClassificationResult } from './utils/error-classifier.util';
import { RetryPolicy } from './utils/retry-policy.util';
import { LostProcessingOwnershipError } from './utils/domain.exceptions';
import { FileProcessingStateRepository } from './repositories/file-processing-state.repository';
import { WorkerExecutionToken } from './types/worker-execution-token.type';
import { IApplicationHandler, WorkerExecutionContext } from '@studyai/infrastructure';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

interface ProcessFileJobData {
  attemptId: string;
  fileId: string;
  traceId?: string;
}

export interface ProcessCheckpointJobData {
  attemptId: string;
  fileId: string;
  sessionId: string;
  checkpointId: string;
  chunkIndex: number;
  startPage: number;
  endPage: number;
  traceId?: string;
}

import { DocumentPersistenceService } from './services/document-persistence.service';

@Injectable()
export class FilesProcessor implements IApplicationHandler<any> {
  private readonly logger = new Logger(FilesProcessor.name);

  constructor(
    private readonly executionService: FileProcessingExecutionService,
    private readonly ragService: RagService,
    private readonly stateRepository: FileProcessingStateRepository,
    private readonly documentPersistenceService: DocumentPersistenceService,
    @InjectMetric('studyai_worker_jobs_total')
    private readonly workerJobsTotal: Counter<string>,
    @InjectMetric('studyai_worker_checkpoint_jobs_total')
    private readonly checkpointJobsTotal: Counter<string>,
    @InjectMetric('studyai_worker_ocr_duration_seconds')
    private readonly ocrDuration: Histogram<string>,
    @InjectMetric('studyai_worker_embedding_duration_seconds')
    private readonly embeddingDuration: Histogram<string>,
    @InjectMetric('studyai_worker_transaction_duration_seconds')
    private readonly dbTxDuration: Histogram<string>,
  ) {}

  async handle(context: WorkerExecutionContext<any>): Promise<void> {
    const payload = context.payload;
    const traceId = payload?.traceId;
    if (traceId) {
      this.logger.log(`[traceId=${traceId}] Worker executing job ${context.jobId}`);
    }



    const { attemptId, fileId } = payload as ProcessFileJobData;
    const queueJobId = context.jobId;

    if (!queueJobId || !attemptId || !fileId) {
      this.logger.error(`Job has missing required properties, discarding`);
      return;
    }

    // 1. Atomic Claim (queued -> processing)
    // Mathematically shifts the increment of processingAttempts here to track crashes.
    const claimResult = await db
      .update(fileProcessingAttempts)
      .set({ 
        status: 'processing',
        processingAttempts: sql`COALESCE(${fileProcessingAttempts.processingAttempts}, 0) + 1` 
      })
      .where(
        and(
          eq(fileProcessingAttempts.id, attemptId),
          eq(fileProcessingAttempts.fileId, fileId),
          eq(fileProcessingAttempts.queueJobId, queueJobId),
          eq(fileProcessingAttempts.status, 'queued')
        )
      )
      .returning({ 
        id: fileProcessingAttempts.id, 
        processingAttempts: fileProcessingAttempts.processingAttempts 
      });

    if (claimResult.length === 0) {
      this.logger.log(`Attempt ${attemptId} claim updated 0 rows. Assuming duplicate/stale and exiting cleanly as no-op.`);
      return;
    }

    const currentProcessingAttempts = claimResult[0].processingAttempts;

    // 1.5 Pre-Execution Viability Guard (breaks infinite crash loops)
    if (currentProcessingAttempts > RetryPolicy.MAX_RETRIES) {
      this.logger.error(`[KPI_WORKER_FAILURE] Attempt ${attemptId} exceeded MAX_RETRIES due to prior repeated crashes. Terminating.`);
      try { this.workerJobsTotal.labels('failed', 'SYSTEM_CRASH_LIMIT').inc(); } catch (e) {}
      try {
        await this.stateRepository.transitionToTerminal(
          { attemptId, fileId, generation: currentProcessingAttempts },
          'failed',
          {
            lastError: 'Maximum attempts exceeded due to repeated worker crashes.',
            errorCode: 'SYSTEM_CRASH_LIMIT',
          },
          undefined,
          'System experienced repeated unexpected failures during processing.'
        );
      } catch (err: any) {
        if (err instanceof LostProcessingOwnershipError) {
          this.logger.warn(`[KPI_WORKER_STALE] Worker lost ownership for attempt ${attemptId} during pre-execution guard. Exiting cleanly.`);
        } else {
          throw err;
        }
      }
      return;
    }

    // Also transition file to processing
    await db
      .update(files)
      .set({ processingStatus: 'processing' })
      .where(and(eq(files.id, fileId), eq(files.processingStatus, 'pending')));

    // 2. Fetch file metadata for extraction
    const fileRecord = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (!fileRecord) {
      this.logger.error(`File ${fileId} not found during processing.`);
      const classification = ErrorClassifier.classify(new Error('File record not found'));
      await this.handleFailure(attemptId, fileId, queueJobId, classification, currentProcessingAttempts);
      return;
    }

    const filePath = join(process.cwd(), 'apps', 'api', 'uploads', fileRecord.storageKey);

    // 3. External Extraction
    let extractedText = '';
    try {
      extractedText = await this.executionService.executeExtraction(
        fileId,
        filePath,
        fileRecord.fileType,
        fileRecord.mimeType || 'application/octet-stream' // fallback
      );
    } catch (error: any) {
      const classification = ErrorClassifier.classify(error);
      await this.handleFailure(attemptId, fileId, queueJobId, classification, currentProcessingAttempts);
      return;
    }

    // Canonical Extraction Contract: Normalize text and build blocks
    const extractedDocument = TextFallbackExtractor.extract(extractedText);
    const canonicalText = extractedDocument.fullText;
    const blocks = extractedDocument.blocks;

    // RAG Generation (outside TX)
    let generatedChunks: any[] = [];
    try {
      if (canonicalText && canonicalText !== 'No extractable text found in this document.') {
        generatedChunks = await this.ragService.generateChunkValues(fileId, canonicalText, 1);
      }
    } catch (error: any) {
      console.error(`[DEBUG-PROCESSOR] Chunk generation failed`, error);
      const classification = ErrorClassifier.classify(error);
      await this.handleFailure(attemptId, fileId, queueJobId, classification, currentProcessingAttempts);
      return;
    }

    // 4. Atomic Publication
    try {
      await this.documentPersistenceService.publish({
        token: { attemptId, fileId, generation: currentProcessingAttempts },
        fileId,
        extractedText: canonicalText,
        structuralBlocks: blocks as any,
        generatedChunks
      });

      // Increment subject fileCount
      if (fileRecord.subjectId) {
        await db
          .update(subjects)
          .set({ fileCount: sql`${subjects.fileCount} + 1` })
          .where(eq(subjects.id, fileRecord.subjectId));
      }

      this.logger.log(`[KPI_WORKER_SUCCESS] Successfully completed processing for attempt ${attemptId}`);
      try { this.workerJobsTotal.labels('success', 'NONE').inc(); } catch (e) {}
    } catch (completionError: any) {
      if (completionError instanceof LostProcessingOwnershipError) {
        this.logger.warn(`[KPI_WORKER_STALE] Worker lost ownership for attempt ${attemptId}. Execution authority revoked. Exiting cleanly.`);
        return;
      }
      this.logger.error(`[KPI_WORKER_FAILURE] Failed during completion transaction for attempt ${attemptId}`, completionError);
      const classification = ErrorClassifier.classify(completionError);
      await this.handleFailure(attemptId, fileId, queueJobId, classification, currentProcessingAttempts);
    }
  }

  private async handleFailure(
    attemptId: string, 
    fileId: string, 
    queueJobId: string, 
    classification: ClassificationResult,
    currentProcessingAttempts: number
  ): Promise<void> {
    const retryResult = RetryPolicy.calculate(currentProcessingAttempts, classification);
    const newStatus = retryResult.shouldRetry ? 'retrying' : 'failed';
    
    if (newStatus === 'failed') {
      this.logger.error(`[KPI_WORKER_FAILURE] Terminal failure for attempt ${attemptId}. Reason: ${classification.errorCode}`);
      try { this.workerJobsTotal.labels('failed', classification.errorCode).inc(); } catch (e) {}
      
      try {
        await this.stateRepository.transitionToTerminal(
          { attemptId, fileId, generation: currentProcessingAttempts },
          'failed',
          {
            lastError: classification.internalMessage,
            errorCode: classification.errorCode,
          },
          undefined,
          classification.userMessage
        );
      } catch (err: any) {
        if (err instanceof LostProcessingOwnershipError) {
          this.logger.warn(`Worker lost ownership during terminal failure recording for attempt ${attemptId}. Skipping.`);
        } else {
          throw err;
        }
      }
    } else {
      this.logger.warn(`[KPI_WORKER_RETRY] Scheduling retry for attempt ${attemptId}. Reason: ${classification.errorCode}`);
      try { this.workerJobsTotal.labels('retry', classification.errorCode).inc(); } catch (e) {}
      const nextRetryAt = new Date(Date.now() + retryResult.delayMs);
      
      // For retrying, we don't cascade to parent file, just update attempt
      // Note: we do NOT increment processingAttempts here anymore, it's done during claim
      await db
        .update(fileProcessingAttempts)
        .set({ 
          status: 'retrying',
          lastError: classification.internalMessage,
          errorCode: classification.errorCode,
          nextRetryAt
        })
        .where(
          and(
            eq(fileProcessingAttempts.id, attemptId),
            eq(fileProcessingAttempts.fileId, fileId),
            eq(fileProcessingAttempts.queueJobId, queueJobId),
            eq(fileProcessingAttempts.status, 'processing')
          )
        );
    }
  }


}
