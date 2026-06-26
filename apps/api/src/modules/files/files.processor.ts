import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { db, eq, and, sql } from '@studyai/database';
import { fileProcessingAttempts, files, subjects } from '@studyai/database';
import { FileProcessingExecutionService } from './services/file-processing-execution.service';
import { RagService } from '../rag/rag.service';
import { join } from 'path';

interface ProcessFileJobData {
  attemptId: string;
  fileId: string;
}

@Processor('file-processing')
export class FilesProcessor extends WorkerHost {
  private readonly logger = new Logger(FilesProcessor.name);

  constructor(
    private readonly executionService: FileProcessingExecutionService,
    private readonly ragService: RagService,
  ) {
    super();
  }

  async process(job: Job<ProcessFileJobData, any, string>): Promise<any> {
    const { attemptId, fileId } = job.data;
    const queueJobId = job.id;

    if (!queueJobId || !attemptId || !fileId) {
      this.logger.error(`Job has missing required properties, discarding`);
      return;
    }

    // 1. Atomic Claim (queued -> processing)
    const claimResult = await db
      .update(fileProcessingAttempts)
      .set({ status: 'processing' })
      .where(
        and(
          eq(fileProcessingAttempts.id, attemptId),
          eq(fileProcessingAttempts.fileId, fileId),
          eq(fileProcessingAttempts.queueJobId, queueJobId),
          eq(fileProcessingAttempts.status, 'queued')
        )
      )
      .returning({ id: fileProcessingAttempts.id });

    if (claimResult.length === 0) {
      // 0 rows affected. Could be a duplicate Redis delivery, or DB is not queued.
      // Must return successful no-op.
      this.logger.log(`Attempt ${attemptId} claim updated 0 rows. Assuming duplicate/stale and exiting cleanly as no-op.`);
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
      await this.handleFailure(attemptId, fileId, queueJobId, 'File record not found');
      return;
    }

    // Note: The execution service needs an absolute file path and mime type
    const filePath = join(process.cwd(), 'uploads', fileRecord.storageKey);

    // 3. External Extraction
    const extractionResult = await this.executionService.executeExtraction(
      fileId,
      filePath,
      fileRecord.fileType,
      fileRecord.mimeType || 'application/octet-stream' // fallback
    );

    if (extractionResult.error) {
      await this.handleFailure(attemptId, fileId, queueJobId, extractionResult.error);
      return;
    }

    // 4. Atomic Completion
    try {
      await db.transaction(async (tx) => {
        const updatedAttempt = await tx
          .update(fileProcessingAttempts)
          .set({ status: 'completed' })
          .where(
            and(
              eq(fileProcessingAttempts.id, attemptId),
              eq(fileProcessingAttempts.fileId, fileId),
              eq(fileProcessingAttempts.queueJobId, queueJobId),
              eq(fileProcessingAttempts.status, 'processing')
            )
          )
          .returning({ id: fileProcessingAttempts.id });

        if (updatedAttempt.length > 0) {
          await tx
            .update(files)
            .set({
              processingStatus: 'completed',
              extractedText: extractionResult.extractedText,
              processedAt: new Date(),
            })
            .where(eq(files.id, fileId));

          // Increment subject fileCount only if guarded update affected exactly one row
          if (fileRecord.subjectId) {
            await tx
              .update(subjects)
              .set({ fileCount: sql`${subjects.fileCount} + 1` })
              .where(eq(subjects.id, fileRecord.subjectId));
          }
        }
      });

      // Best-effort RAG indexing after DB commit
      try {
        await this.ragService.indexFile(fileId, extractionResult.extractedText);
      } catch (ragErr) {
        this.logger.error(`Non-fatal: Failed to index file ${fileId} in RAG.`, ragErr);
      }

      this.logger.log(`Successfully completed processing for attempt ${attemptId}`);
    } catch (completionError) {
      this.logger.error(`Failed during completion transaction for attempt ${attemptId}`, completionError);
      await this.handleFailure(attemptId, fileId, queueJobId, 'Failed during DB completion transaction');
    }
  }

  private async handleFailure(attemptId: string, fileId: string, queueJobId: string, errorMsg: string): Promise<void> {
    await db.transaction(async (tx) => {
      const failedAttempt = await tx
        .update(fileProcessingAttempts)
        .set({ status: 'failed' })
        .where(
          and(
            eq(fileProcessingAttempts.id, attemptId),
            eq(fileProcessingAttempts.fileId, fileId),
            eq(fileProcessingAttempts.queueJobId, queueJobId),
            eq(fileProcessingAttempts.status, 'processing')
          )
        )
        .returning({ id: fileProcessingAttempts.id });

      if (failedAttempt.length > 0) {
        await tx
          .update(files)
          .set({
            processingStatus: 'failed',
            processingError: errorMsg,
          })
          .where(eq(files.id, fileId));
      }
    });
  }
}
