import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { files } from './files';
import { documentVersions } from './document_engine';

export const fileProcessingStatusEnum = pgEnum('file_processing_status', [
  'enqueue_pending',
  'dispatching',
  'queued',
  'processing',
  'completed',
  'failed',
  'enqueue_failed',
  'retrying'
]);

export const fileProcessingAttempts = pgTable('file_processing_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  queueJobId: varchar('queue_job_id', { length: 255 }).notNull().unique(),
  status: fileProcessingStatusEnum('status').notNull().default('enqueue_pending'),
  dispatchLeaseStartedAt: timestamp('dispatch_lease_started_at', { withTimezone: true }),
  dispatchAttempts: integer('dispatch_attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdateFn(() => new Date()),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  lastError: text('last_error'),
  errorCode: varchar('error_code', { length: 255 }),
  processingAttempts: integer('processing_attempts').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
}, (table) => {
  return {
    fileIdIdx: index('file_processing_attempts_file_id_idx').on(table.fileId),
    activeAttemptPartialIdx: uniqueIndex('file_processing_active_attempt_idx').on(table.fileId).where(
      sql`${table.status} IN ('enqueue_pending', 'dispatching', 'queued', 'processing', 'retrying')`
    )
  };
});

export const fileProcessingAttemptsRelations = relations(fileProcessingAttempts, ({ one }) => ({
  file: one(files, {
    fields: [fileProcessingAttempts.fileId],
    references: [files.id],
  }),
  documentVersion: one(documentVersions, {
    fields: [fileProcessingAttempts.id],
    references: [documentVersions.attemptId],
  }),
}));
