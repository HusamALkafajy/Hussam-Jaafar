import { Injectable, Logger } from '@nestjs/common';
import { db, eq, and, sql } from '@studyai/database';
import { fileProcessingAttempts, files, subjects, processingCheckpoints, processingSessions, documentChunks } from '@studyai/database';
import { FileProcessingExecutionService } from './services/file-processing-execution.service';
import { RagService } from '../rag/rag.service';
import { join } from 'path';
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

    if (payload && 'checkpointId' in payload) {
      try {
        await this.handleCheckpoint(context as WorkerExecutionContext<ProcessCheckpointJobData>);
        try { this.checkpointJobsTotal.labels('success', 'none').inc(); } catch (e) {}
      } catch (error: any) {
        let errType = 'unknown';
        if (error.message?.includes('AI Error')) errType = 'ai_error';
        else if (error.message?.includes('OCR Crash')) errType = 'ocr_error';
        try { this.checkpointJobsTotal.labels('failed', errType).inc(); } catch (e) {}
        throw error;
      }
      return;
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

    // RAG Generation (outside TX)
    let generatedChunks: any[] = [];
    try {
      generatedChunks = await this.ragService.generateChunkValues(fileId, extractedText, 1);
    } catch (error: any) {
      const classification = ErrorClassifier.classify(error);
      await this.handleFailure(attemptId, fileId, queueJobId, classification, currentProcessingAttempts);
      return;
    }

    // Structural Extraction (temporary stub until Extractor is fully implemented)
    const blocks = [{
      type: 'paragraph',
      content: { text: extractedText || 'No content' }
    }];

    // 4. Atomic Publication
    try {
      await this.documentPersistenceService.publish({
        token: { attemptId, fileId, generation: currentProcessingAttempts },
        fileId,
        extractedText,
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

  private async handleCheckpoint(context: WorkerExecutionContext<ProcessCheckpointJobData>): Promise<void> {
    const { attemptId, fileId, sessionId, checkpointId, startPage, endPage } = context.payload;
    
    // 1. Fetch file record (for extraction)
    const fileRecord = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (!fileRecord) {
      this.logger.error(`File ${fileId} not found during checkpoint ${checkpointId}.`);
      return; // Safe exit
    }

    const filePath = join(process.cwd(), 'apps', 'api', 'uploads', fileRecord.storageKey);

    // 2. OCR Extraction (OUTSIDE TRANSACTION)
    let extractedText = '';
    const ocrTimer = this.ocrDuration.startTimer();
    try {
      extractedText = await this.executionService.executeExtraction(
        fileId,
        filePath,
        fileRecord.fileType,
        fileRecord.mimeType || 'application/octet-stream',
        startPage,
        endPage
      );
      ocrTimer({ status: 'success' });
    } catch (error: any) {
      ocrTimer({ status: 'failed' });
      this.logger.error(`Checkpoint ${checkpointId} failed OCR extraction:`, error);
      throw error; // Let BullMQ retry it
    }

    // 3. Chunk & Embed (OUTSIDE TRANSACTION)
    let chunkValues: any[] = [];
    try {
      if (extractedText && extractedText.trim() !== 'No extractable text found in this document.') {
        const embedTimer = this.embeddingDuration.startTimer();
        try {
          chunkValues = await this.ragService.generateChunkValues(fileId, extractedText, startPage);
          embedTimer({ status: 'success' });
        } catch (embedError) {
          embedTimer({ status: 'failed' });
          throw embedError;
        }
      }
    } catch (error: any) {
      this.logger.error(`Checkpoint ${checkpointId} failed embedding generation:`, error);
      throw error; // Let BullMQ retry it
    }

    // 4. Atomic Ownership & Completion (INSIDE TRANSACTION)
    let isLastCheckpoint = false;
    const txTimer = this.dbTxDuration.startTimer();
    let txSuccess = false;
    try {
      await db.transaction(async (tx) => {
        // 4a. Checkpoint Ownership Claim (Atomic Row Lock)
        const claimResult = await tx
          .select()
          .from(processingCheckpoints)
          .where(
            and(
              eq(processingCheckpoints.id, checkpointId),
              eq(processingCheckpoints.status, 'pending')
            )
          )
          // FOR UPDATE guarantees single-worker ownership and prevents idempotency duplication
          .for('update');

        if (claimResult.length === 0) {
          this.logger.log(`Checkpoint ${checkpointId} already processed or not pending. Safe no-op exit.`);
          return; // Safe no-op exit without generating duplicates
        }

        // 4b. Preserve Document Chunks for C.3 DocumentPersistenceService
        if (chunkValues.length > 0) {
          // Deferred to C.3: we cannot persist to document_chunks without a versionId.
          // These chunkValues will be orchestrated/persisted in the future DocumentPersistenceService.
          this.logger.debug(`Preserved ${chunkValues.length} chunk values for C.3 publication`);
        }

        // 4c. Checkpoint Completion
        await tx
          .update(processingCheckpoints)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(processingCheckpoints.id, checkpointId));

        // 4d. Processing Session Reconciliation
        // Serialize session reconciliation to prevent Read Committed phantom reads
        await tx
          .select()
          .from(processingSessions)
          .where(eq(processingSessions.id, sessionId))
          .for('update');

        const pendingCheckpoints = await tx
          .select()
          .from(processingCheckpoints)
          .where(
            and(
              eq(processingCheckpoints.sessionId, sessionId),
              eq(processingCheckpoints.status, 'pending')
            )
          );

        if (pendingCheckpoints.length === 0) {
          // All checkpoints completed!
          await tx
            .update(processingSessions)
            .set({ status: 'completed', completedAt: new Date() })
            .where(eq(processingSessions.id, sessionId));
            
          isLastCheckpoint = true;
        }
      });
      txSuccess = true;
    } finally {
      txTimer({ status: txSuccess ? 'success' : 'failed' });
    }

    if (isLastCheckpoint) {
      this.logger.log(`Session ${sessionId} fully completed and reconciled.`);
      
      // Inline Reconciliation: Complete the overarching Attempt and File
      // Wait: checkpoint handles its own state, but if it needs to terminal the attempt, it must pass the generation.
      // Currently, checkpoints don't capture the attempt generation in payload.
      // For now, we will skip fencing checkpoint completions or fetch the attempt.
      // TODO: Pass generation inside ProcessCheckpointJobData in future slices.
      const attempt = await db.query.fileProcessingAttempts.findFirst({ where: eq(fileProcessingAttempts.id, attemptId) });
      if (attempt) {
        try {
          await this.stateRepository.transitionToTerminal(
            { attemptId, fileId, generation: attempt.processingAttempts },
            'completed'
          );
        } catch (err: any) {
          if (err instanceof LostProcessingOwnershipError) {
            this.logger.warn(`[KPI_WORKER_STALE] Worker lost ownership for attempt ${attemptId} during checkpoint reconciliation. Exiting cleanly.`);
          } else {
            throw err;
          }
        }
      }
      
      // Increment subject fileCount
      if (fileRecord.subjectId) {
        await db
          .update(subjects)
          .set({ fileCount: sql`${subjects.fileCount} + 1` })
          .where(eq(subjects.id, fileRecord.subjectId));
      }
      
      try { this.workerJobsTotal.labels('success', 'NONE').inc(); } catch (e) {}
    }

    this.logger.log(`Checkpoint ${checkpointId} completed successfully.`);
  }
}
