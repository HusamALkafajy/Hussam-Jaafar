import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db, eq, and, sql, fileProcessingAttempts } from '@studyai/database';
import { FileProcessingDispatcherService } from './file-processing-dispatcher.service';
import { FileProcessingStateRepository } from '../repositories/file-processing-state.repository';

@Injectable()
export class FileProcessingReconcilerService {
  private readonly logger = new Logger(FileProcessingReconcilerService.name);

  constructor(
    private readonly dispatcher: FileProcessingDispatcherService,
    private readonly stateRepository: FileProcessingStateRepository,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileDispatchingAttempts(): Promise<void> {
    const LEASE_MS = 30000; // 30 seconds
    const MAX_DISPATCH_ATTEMPTS = 5;
    const cutoffTime = new Date(Date.now() - LEASE_MS);

    // Find expired dispatching attempts
    const expiredAttempts = await db.query.fileProcessingAttempts.findMany({
      where: and(
        eq(fileProcessingAttempts.status, 'dispatching'),
        sql`${fileProcessingAttempts.dispatchLeaseStartedAt} <= ${cutoffTime.toISOString()}`
      ),
    });

    for (const attempt of expiredAttempts) {
      this.logger.warn(`Reconciling expired dispatching attempt ${attempt.id}`);
      
      const newAttempts = (attempt.dispatchAttempts ?? 0) + 1;

      if (newAttempts >= MAX_DISPATCH_ATTEMPTS) {
        await this.stateRepository.transitionToTerminal(
          attempt.id,
          attempt.fileId,
          'enqueue_failed',
          { dispatchAttempts: newAttempts },
          undefined,
          'System failed to queue file for processing'
        );
        this.logger.error(`Attempt ${attempt.id} reached max dispatch attempts. Marked enqueue_failed.`);
      } else {
        await db
          .update(fileProcessingAttempts)
          .set({ status: 'enqueue_pending', dispatchAttempts: newAttempts })
          .where(eq(fileProcessingAttempts.id, attempt.id));
        
        // Trigger dispatcher again
        await this.dispatcher.dispatchAttempt(attempt.id);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileRetryingAttempts(): Promise<void> {
    const now = new Date();

    // Atomically transition all due retrying attempts to enqueue_pending
    // The Dispatcher Outbox sweep will eventually pick these up.
    await db
      .update(fileProcessingAttempts)
      .set({ status: 'enqueue_pending' })
      .where(
        and(
          eq(fileProcessingAttempts.status, 'retrying'),
          sql`${fileProcessingAttempts.nextRetryAt} <= ${now.toISOString()}`
        )
      );

    this.logger.log(`Completed retry scheduler transition sweep.`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileEnqueuePendingAttempts(): Promise<void> {
    const GRACE_PERIOD_MS = 60000; // 1 minute grace period for immediate dispatch
    const cutoffTime = new Date(Date.now() - GRACE_PERIOD_MS);

    const pendingAttempts = await db.query.fileProcessingAttempts.findMany({
      where: and(
        eq(fileProcessingAttempts.status, 'enqueue_pending'),
        sql`${fileProcessingAttempts.updatedAt} <= ${cutoffTime.toISOString()}`
      ),
    });

    for (const attempt of pendingAttempts) {
      this.logger.warn(`Sweeping orphaned enqueue_pending attempt ${attempt.id}`);
      await this.dispatcher.dispatchAttempt(attempt.id);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileQueuedAttempts(): Promise<void> {
    const QUEUED_LEASE_MS = 300000; // 5 minutes
    const cutoffTime = new Date(Date.now() - QUEUED_LEASE_MS);

    await db
      .update(fileProcessingAttempts)
      .set({ status: 'enqueue_pending' })
      .where(
        and(
          eq(fileProcessingAttempts.status, 'queued'),
          sql`${fileProcessingAttempts.updatedAt} <= ${cutoffTime.toISOString()}`
        )
      );

    this.logger.log(`Completed queued recovery sweep.`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileProcessingAttempts(): Promise<void> {
    const PROCESSING_LEASE_MS = 900000; // 15 minutes
    const cutoffTime = new Date(Date.now() - PROCESSING_LEASE_MS);

    await db
      .update(fileProcessingAttempts)
      .set({ 
        status: 'enqueue_pending',
        lastError: 'Worker execution timeout (Crash assumed)',
      })
      .where(
        and(
          eq(fileProcessingAttempts.status, 'processing'),
          sql`${fileProcessingAttempts.updatedAt} <= ${cutoffTime.toISOString()}`
        )
      );

    this.logger.log(`Completed processing recovery sweep.`);
  }
}
