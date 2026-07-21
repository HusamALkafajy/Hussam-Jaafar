import { Injectable, Logger, Inject } from '@nestjs/common';
import { db, eq, and, sql, fileProcessingAttempts, files } from '@studyai/database';
import { IQueue } from '@studyai/infrastructure';
import * as crypto from 'crypto';

@Injectable()
export class FileProcessingDispatcherService {
  private readonly logger = new Logger(FileProcessingDispatcherService.name);

  constructor(
    @Inject('IQueue') private readonly fileProcessingQueue: IQueue,
  ) {}

  async dispatchPendingAttempts(): Promise<void> {
    // Phase 10A dispatcher logic (typically invoked from API or reconciler)
    // For now, invoked by FilesService directly upon upload
  }

  async dispatchAttempt(attemptId: string): Promise<void> {

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

}
