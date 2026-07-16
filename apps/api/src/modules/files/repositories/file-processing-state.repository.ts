import { Injectable } from '@nestjs/common';
import { db, eq, and, sql, files, fileProcessingAttempts } from '@studyai/database';

export type TerminalAttemptStatus = 'completed' | 'failed' | 'enqueue_failed';

@Injectable()
export class FileProcessingStateRepository {
  /**
   * Atomically transitions an attempt to a terminal state and synchronously cascades 
   * the equivalent terminal state to the parent files record.
   * 
   * @param attemptId The attempt to terminate
   * @param fileId The parent file ID
   * @param finalStatus The terminal status for the attempt
   * @param additionalAttemptData Additional fields to set on the attempt (e.g. error messages)
   * @param extractedText Text to save on the file (if completed)
   * @param userMessage User-facing error message (if failed)
   */
  async transitionToTerminal(
    attemptId: string,
    fileId: string,
    finalStatus: TerminalAttemptStatus,
    additionalAttemptData: Partial<typeof fileProcessingAttempts.$inferInsert> = {},
    extractedText?: string,
    userMessage?: string
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
        .where(eq(fileProcessingAttempts.id, attemptId))
        .returning({ id: fileProcessingAttempts.id });

      if (attemptUpdate.length === 0) {
        // Attempt does not exist, safe to abort to avoid corrupting parent
        return;
      }

      // 2. Cascade to parent file
      if (targetFileStatus) {
        await tx
          .update(files)
          .set({
            processingStatus: targetFileStatus,
            ...(targetFileStatus === 'completed' && extractedText ? { extractedText } : {}),
            ...(targetFileStatus === 'completed' ? { processedAt: new Date() } : {}),
            ...(targetFileStatus === 'failed' && userMessage ? { processingError: userMessage } : {})
          })
          .where(eq(files.id, fileId));
      }
    });
  }
}
