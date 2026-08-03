import { Inject, Injectable, Logger } from '@nestjs/common';
import { db, eq, and, sql } from '@studyai/database';
import { fileProcessingAttempts, files, subjects, documentChunks } from '@studyai/database';
import { RagService } from '../rag/rag.service';
import { join } from 'path';
import { ExtractorRegistry } from './services/extractor.registry';
import { DocumentExtractionContext } from './contracts/document-extractor';
import { ErrorClassifier, ClassificationResult } from './utils/error-classifier.util';
import { RetryPolicy } from './utils/retry-policy.util';
import { LostProcessingOwnershipError, ExtractionTimeoutError } from './utils/domain.exceptions';
import { FileProcessingStateRepository } from './repositories/file-processing-state.repository';
import { DocumentPersistenceService } from './services/document-persistence.service';
import { PipelineRunner } from './services/pipeline/pipeline-runner';
import { PipelineContext } from './services/pipeline/pipeline-stage.interface';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { IStorageProvider } from '@studyai/infrastructure';
import { SemanticChunk } from '../rag/chunking/contracts/semantic-chunk';

const resolveChunkPageNumber = (chunk: SemanticChunk): number | undefined => {
  const sourcePages = chunk.structuralMetadata?.sourcePages ?? Array.from(new Set(
    (chunk.chunkContent ?? [])
      .map((block) => block.metadata?.sourcePage)
      .filter((page): page is number => Number.isInteger(page) && page > 0),
  )).sort((left, right) => left - right);

  return sourcePages.length === 1 ? sourcePages[0] : undefined;
};

@Injectable()
export class FilesProcessor {
  private readonly logger = new Logger(FilesProcessor.name);

  constructor(
    private readonly pipelineRunner: PipelineRunner,
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
    @Inject('IStorageProvider') private readonly storageProvider?: IStorageProvider,
  ) {}

  async handle(job: any): Promise<void> {
    const context = job.data || job;
    const { attemptId, fileId } = context.payload;
    const queueJobId = context.jobId;

    if (!queueJobId || !attemptId || !fileId) {
      this.logger.error(`Job has missing required properties, discarding`);
      return;
    }

    // 1. Atomic Claim (queued -> processing)
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

    // 1.5 Pre-Execution Viability Guard
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

    await db
      .update(files)
      .set({ processingStatus: 'processing' })
      .where(and(eq(files.id, fileId), eq(files.processingStatus, 'pending')));

    // 2. Fetch file metadata
    const fileRecord = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (!fileRecord) {
      this.logger.error(`File ${fileId} not found during processing.`);
      const classification = ErrorClassifier.classify(new Error('File record not found'));
      await this.handleFailure(attemptId, fileId, queueJobId, classification, currentProcessingAttempts);
      return;
    }

    // Legacy non-PDF extractors still consume a local path. The local storage
    // adapter maps it beneath the configured documents bucket; PDFs use the
    // storage stream above and never depend on this path.
    const filePath = join(process.cwd(), 'apps', 'api', 'uploads', 'documents', fileRecord.storageKey);

    // 3. Generic Pipeline Boundary with Execution Hard Bound (5 minutes)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(new ExtractionTimeoutError('Pipeline exceeded the maximum execution bound of 5 minutes.')), 300_000);
    
    const pipelineContext: PipelineContext = {
      attemptId,
      fileId,
      userId: fileRecord.userId,
      signal: abortController.signal,
      state: {},
      reportProgress: async (stage, progress) => {
        // Here we could update `fileProcessingAttempts` if we added a JSON state field, 
        // or just log for now.
        this.logger.debug(`[PipelineProgress] Stage: ${stage}, Progress: ${progress}%`);
      },
      log: (level, message, meta) => {
        if (level === 'error') this.logger.error(message, meta);
        else if (level === 'warn') this.logger.warn(message, meta);
        else this.logger.log(message);
      }
    };

    const initialInput: Record<string, unknown> = {
      fileId,
      filePath,
      mimeType: fileRecord.mimeType || 'application/octet-stream',
      fileType: fileRecord.fileType as any,
    };

    let finalState;
    try {
      // Original PDF bytes are read through the storage boundary. This keeps
      // the native extractor independent of a temporary filesystem path and
      // makes persistent-volume storage replaceable by an object-storage
      // adapter.
      if (fileRecord.mimeType === 'application/pdf') {
        if (!this.storageProvider) throw new Error('Document storage provider is unavailable.');
        const stream = await this.storageProvider.download('documents', fileRecord.storageKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        initialInput.fileData = Buffer.concat(chunks);
      }
      finalState = await this.pipelineRunner.execute(initialInput, pipelineContext);
    } catch (error: any) {
      this.logger.error('FilesProcessor pipeline failed', error);
      let finalError = error;
      if (abortController.signal.aborted && !(error instanceof ExtractionTimeoutError) && error.name !== 'ExtractionTimeoutError') {
         finalError = abortController.signal.reason || new ExtractionTimeoutError('Pipeline exceeded the maximum execution bound of 5 minutes.');
      }
      const classification = ErrorClassifier.classify(finalError);
      await this.handleFailure(attemptId, fileId, queueJobId, classification, currentProcessingAttempts);
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    const { extractedDocument, chunks } = finalState;
    const canonicalText = extractedDocument?.fullText || '';
    const blocks = extractedDocument?.blocks || [];

    // 4. Atomic Publication
    try {
      await this.documentPersistenceService.publish({
        token: { attemptId, fileId, generation: currentProcessingAttempts },
        fileId,
        extractedText: canonicalText,
        structuralBlocks: blocks as any,
        extractionMetadata: extractedDocument?.metadata,
        generatedChunks: chunks?.map((c: SemanticChunk, index: number) => ({
          fileId,
          content: c.plainText,
          chunkIndex: c.chunkOrder ?? index,
          pageNumber: resolveChunkPageNumber(c),
        })) || [] // Semantic chunks mapped to the persisted RAG contract
      });

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
          classification.userMessage,
          classification.errorCode === 'MISSING_TEXT_LAYER'
            ? { extractionStatus: 'ocr_required' }
            : { extractionStatus: 'failed' },
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
