import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db, eq, and, or, sql, fileProcessingAttempts, files, processingSessions, processingCheckpoints } from '@studyai/database';
import { IQueue } from '@studyai/infrastructure';
import { PdfUtility } from '../utils/pdf.util';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class FileProcessingDispatcherService {
  private readonly logger = new Logger(FileProcessingDispatcherService.name);

  constructor(
    @Inject('IQueue') private readonly fileProcessingQueue: IQueue,
    private readonly configService: ConfigService,
  ) {}

  async dispatchPendingAttempts(): Promise<void> {
    // Phase 10A dispatcher logic (typically invoked from API or reconciler)
    // For now, invoked by FilesService directly upon upload
  }

  async dispatchAttempt(attemptId: string): Promise<void> {
    const ENABLE_V2_PIPELINE = this.configService.get<string>('ENABLE_V2_PIPELINE') !== 'false';

    try {
      const claimResult = await db
        .update(fileProcessingAttempts)
        .set({
          status: 'dispatching',
          dispatchLeaseStartedAt: new Date(),
        })
        .where(
          and(
            eq(fileProcessingAttempts.id, attemptId),
            eq(fileProcessingAttempts.status, 'enqueue_pending')
          )
        )
        .returning({
          id: fileProcessingAttempts.id,
          fileId: fileProcessingAttempts.fileId,
          queueJobId: fileProcessingAttempts.queueJobId,
        });

      if (claimResult.length === 0) {
        return;
      }

      const attempt = claimResult[0];

      // Fetch the file to check its type
      const fileResult = await db.select().from(files).where(eq(files.id, attempt.fileId)).limit(1);
      if (fileResult.length === 0) {
        this.logger.error(`File ${attempt.fileId} not found for attempt ${attemptId}`);
        return;
      }
      const file = fileResult[0];

      const traceId = crypto.randomUUID();

      if (ENABLE_V2_PIPELINE && file.fileType === 'pdf') {
        await this.dispatchDocumentV2(attemptId, file, traceId);
        return;
      }

      const jobOptions = {
        jobId: attempt.queueJobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1, // Phase 10A constraint: attempts = 1
      };

      // Transition to queued first to prevent race condition where worker claims job before DB is updated
      await db
        .update(fileProcessingAttempts)
        .set({ status: 'queued' })
        .where(
          and(
            eq(fileProcessingAttempts.id, attemptId),
            eq(fileProcessingAttempts.status, 'dispatching')
          )
        );

      await this.fileProcessingQueue.enqueue({
        jobId: attempt.queueJobId,
        jobType: 'process-file',
        priority: 0,
        payload: { attemptId: attempt.id, fileId: attempt.fileId, traceId },
      });
      
      this.logger.log(`Successfully dispatched attempt ${attemptId}`);
    } catch (error) {
      this.logger.error(`Failed to dispatch attempt ${attemptId}`, error);
      
      // Synchronous rollback to enqueue_pending for immediate retry
      await db
        .update(fileProcessingAttempts)
        .set({ status: 'enqueue_pending' })
        .where(
          and(
            eq(fileProcessingAttempts.id, attemptId),
            eq(fileProcessingAttempts.status, 'queued')
          )
        );
    }
  }

  private async dispatchDocumentV2(attemptId: string, file: any, traceId: string): Promise<void> {
    // 1. Idempotency Check
    const existingSessions = await db.select().from(processingSessions).where(
      and(
        eq(processingSessions.fileId, file.id),
        eq(processingSessions.status, 'pending')
      )
    ).limit(1);

    let sessionId: string;
    let checkpoints: any[] = [];

    if (existingSessions.length > 0) {
      this.logger.log(`Found existing pending session for file ${file.id}. Resuming.`);
      sessionId = existingSessions[0].id;
      checkpoints = await db.select().from(processingCheckpoints).where(eq(processingCheckpoints.sessionId, sessionId));
    } else {
      // 2. Page count calculation
      const uploadDir = path.resolve(process.cwd(), 'apps/api/uploads');
      const storagePath = path.join(uploadDir, file.storageKey);
      
      let pageCount = 1;
      try {
        pageCount = await PdfUtility.getPageCountFromFile(storagePath);
        if (pageCount < 1) {
          throw new Error('PDF has 0 pages');
        }
      } catch (e) {
        this.logger.error(`Failed to get page count for PDF ${file.id}`, e);
        throw e;
      }

      const CHUNK_SIZE = 5;
      const totalChunks = Math.ceil(pageCount / CHUNK_SIZE);

      // 3. Transaction
      await db.transaction(async (tx) => {
        const sessionResult = await tx.insert(processingSessions).values({
          fileId: file.id,
          status: 'pending',
          totalChunks,
        }).returning();
        
        sessionId = sessionResult[0].id;
        
        const checkpointInserts = [];
        for (let i = 0; i < totalChunks; i++) {
          const startPage = i * CHUNK_SIZE + 1;
          const endPage = Math.min((i + 1) * CHUNK_SIZE, pageCount);
          
          checkpointInserts.push({
            sessionId,
            chunkIndex: i,
            startPage,
            endPage,
            status: 'pending',
          });
        }
        
        if (checkpointInserts.length > 0) {
          checkpoints = await tx.insert(processingCheckpoints).values(checkpointInserts).returning();
        } else {
          checkpoints = [];
        }
      });
    }

    // 4. Enqueue BullMQ jobs
    for (const checkpoint of checkpoints) {
      await this.fileProcessingQueue.enqueue({
        jobId: `checkpoint_${checkpoint.id}`, // Deterministic ID
        jobType: 'process-checkpoint',
        priority: 0,
        payload: { 
          attemptId,
          fileId: file.id, 
          sessionId: sessionId!, 
          checkpointId: checkpoint.id,
          chunkIndex: checkpoint.chunkIndex,
          startPage: checkpoint.startPage,
          endPage: checkpoint.endPage,
          traceId,
        },
      });
    }

    // 5. Completion of Dispatch Phase
    await db.update(fileProcessingAttempts)
      .set({ status: 'completed', finishedAt: new Date() })
      .where(eq(fileProcessingAttempts.id, attemptId));
      
    this.logger.log(`Successfully dispatched V2 orchestration for attempt ${attemptId}`);
  }
}
