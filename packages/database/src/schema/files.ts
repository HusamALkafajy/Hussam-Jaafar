import { pgTable, uuid, varchar, bigint, integer, text, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { subjects } from './subjects';
import { summaries } from './summaries';
import { explanations } from './explanations';
import { exams } from './exams';
import { flashcardSets } from './flashcards';
import { chatSessions } from './chat';

export const fileTypeEnum = pgEnum('file_type', ['pdf', 'docx', 'image']);
export const processingStatusEnum = pgEnum('processing_status', ['pending', 'processing', 'completed', 'failed']);

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  storageUrl: varchar('storage_url', { length: 500 }).notNull(),
  fileType: fileTypeEnum('file_type').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  pageCount: integer('page_count'),
  extractedText: text('extracted_text'),
  metadata: jsonb('metadata'),
  processingStatus: processingStatusEnum('processing_status').default('pending').notNull(),
  processingError: text('processing_error'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const filesRelations = relations(files, ({ one, many }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  subject: one(subjects, {
    fields: [files.subjectId],
    references: [subjects.id],
  }),
  summaries: many(summaries),
  explanations: many(explanations),
  exams: many(exams),
  flashcardSets: many(flashcardSets),
  chatSessions: many(chatSessions),
}));
