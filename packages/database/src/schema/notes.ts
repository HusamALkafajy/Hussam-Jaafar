import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { files } from './files';

/**
 * Notes — user-authored notes anchored optionally to a document.
 * AI-generated summary and quiz questions are stored in-row for instant access.
 */
export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  // Optional: attach note to a specific uploaded document
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull().default('Untitled Note'),
  content: text('content').notNull().default(''),
  // AI-generated fields — null until the user clicks "Analyze"
  aiSummary: text('ai_summary'),
  // Array<{ question: string; answer: string; type: 'mcq' | 'short' }>
  quizQuestions: jsonb('quiz_questions'),
  // Visual tag color (e.g. 'default', 'red', 'green', 'blue', 'yellow', 'purple')
  color: varchar('color', { length: 30 }).default('default').notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  lastAnalyzedAt: timestamp('last_analyzed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
  file: one(files, { fields: [notes.fileId], references: [files.id] }),
}));
