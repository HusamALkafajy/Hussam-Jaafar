import { Injectable } from '@nestjs/common';
import { db, eq, and, sql, files, fileProcessingAttempts } from '@studyai/database';
import { WorkerExecutionToken } from '../types/worker-execution-token.type';
import { LostProcessingOwnershipError } from '../utils/domain.exceptions';

export type TerminalAttemptStatus = 'completed' | 'failed' | 'enqueue_failed';

@Injectable()
export class FileProcessingStateRepository {
  /**
   * Atomically transitions an attempt to a terminal state and synchronously cascades 
   * the equivalent terminal state to the parent files record.
   * 
   * @param token The WorkerExecutionToken holding identity and generation
   * @param finalStatus The terminal status for the attempt
   * @param additionalAttemptData Additional fields to set on the attempt (e.g. error messages)
   * @param extractedText Text to save on the file (if completed)
   * @param userMessage User-facing error message (if failed)
   */
  async transitionToTerminal(
    token: WorkerExecutionToken,
    finalStatus: TerminalAttemptStatus,
    additionalAttemptData: Partial<typeof fileProcessingAttempts.$inferInsert> = {},
    extractedText?: string,
    userMessage?: string,
    fileMetadata?: Record<string, unknown>,
  ): Promise<void> {
    
    let targetFileStatus: 'completed' | 'failed' | null = null;
    switch (finalStatus) {
      case 'completed':
        targetFileStatus = 'completed';
        break;
      case 'failed':
      case 'enqueue_failed':
        targetFileStatus = 'failed';
        break;
    }

    await db.transaction(async (tx) => {
      // 1. Update child attempt
      const attemptUpdate = await tx
        .update(fileProcessingAttempts)
        .set({
          status: finalStatus,
          finishedAt: new Date(),
          ...additionalAttemptData
        })
        .where(
          and(
            eq(fileProcessingAttempts.id, token.attemptId),
            eq(fileProcessingAttempts.processingAttempts, token.generation),
            eq(fileProcessingAttempts.status, 'processing')
          )
        )
        .returning({ id: fileProcessingAttempts.id });

      if (attemptUpdate.length === 0) {
        // Attempt does not exist, or Worker lost the fencing token generation. Safe to abort.
        throw new LostProcessingOwnershipError('Worker lost execution lease or attempt was aborted.');
      }

      // 2. Cascade to parent file
      if (targetFileStatus) {
        await tx
          .update(files)
          .set({
            processingStatus: targetFileStatus,
            ...(targetFileStatus === 'completed' && extractedText ? { extractedText } : {}),
            ...(targetFileStatus === 'completed' ? { processedAt: new Date() } : {}),
            ...(targetFileStatus === 'failed' && userMessage ? { processingError: userMessage } : {}),
            ...(fileMetadata ? { metadata: fileMetadata } : {})
          })
          .where(eq(files.id, token.fileId));
      }
    });
  }
}
