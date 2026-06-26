import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db, eq, and, sql, fileProcessingAttempts } from '@studyai/database';
import { FileProcessingDispatcherService } from './file-processing-dispatcher.service';

@Injectable()
export class FileProcessingReconcilerService {
  private readonly logger = new Logger(FileProcessingReconcilerService.name);

  constructor(
    private readonly dispatcher: FileProcessingDispatcherService,
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
        await db
          .update(fileProcessingAttempts)
          .set({ status: 'enqueue_failed', dispatchAttempts: newAttempts })
          .where(eq(fileProcessingAttempts.id, attempt.id));
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
}
