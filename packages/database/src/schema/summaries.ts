import { pgTable, uuid, text, jsonb, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { files } from './files';
import { users } from './users';

export const summaryLevelEnum = pgEnum('summary_level', ['short', 'medium', 'comprehensive']);

export const summaries = pgTable('summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  level: summaryLevelEnum('level').notNull(),
  content: text('content').notNull(),
  keyPoints: jsonb('key_points'),
  definitions: jsonb('definitions'),
  lawsFormulas: jsonb('laws_formulas'),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const summariesRelations = relations(summaries, ({ one }) => ({
  file: one(files, {
    fields: [summaries.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [summaries.userId],
    references: [users.id],
  }),
}));
