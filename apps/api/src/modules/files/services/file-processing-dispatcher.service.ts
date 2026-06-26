import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { db, eq, and, sql, fileProcessingAttempts } from '@studyai/database';

@Injectable()
export class FileProcessingDispatcherService {
  private readonly logger = new Logger(FileProcessingDispatcherService.name);

  constructor(
    @InjectQueue('file-processing') private readonly fileProcessingQueue: Queue,
  ) {}

  async dispatchPendingAttempts(): Promise<void> {
    // Phase 10A dispatcher logic (typically invoked from API or reconciler)
    // For now, invoked by FilesService directly upon upload
  }

  async dispatchAttempt(attemptId: string): Promise<void> {
    const attempt = await db.query.fileProcessingAttempts.findFirst({
      where: eq(fileProcessingAttempts.id, attemptId),
    });

    if (!attempt || attempt.status !== 'enqueue_pending') {
      return;
    }

    try {
      // Transition to dispatching
      await db
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
        );

      const jobOptions = {
        jobId: attempt.queueJobId,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1, // Phase 10A constraint: attempts = 1
      };

      await this.fileProcessingQueue.add(
        'process-file',
        { attemptId, fileId: attempt.fileId },
        jobOptions
      );

      // Transition to queued
      await db
        .update(fileProcessingAttempts)
        .set({ status: 'queued' })
        .where(
          and(
            eq(fileProcessingAttempts.id, attemptId),
            eq(fileProcessingAttempts.status, 'dispatching')
          )
        );
      
      this.logger.log(`Successfully dispatched attempt ${attemptId}`);
    } catch (error) {
      this.logger.error(`Failed to dispatch attempt ${attemptId}`, error);
      // Let reconciler sweep it since it's stuck in 'dispatching'
    }
  }
}
