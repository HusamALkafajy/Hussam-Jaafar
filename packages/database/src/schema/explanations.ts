import { pgTable, uuid, text, jsonb, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { files } from './files';
import { users } from './users';

export const explanationLevelEnum = pgEnum('explanation_level', ['simple', 'intermediate', 'academic']);

export const explanations = pgTable('explanations', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  level: explanationLevelEnum('level').notNull(),
  content: text('content').notNull(),
  examples: jsonb('examples'),
  comprehensionQuestions: jsonb('comprehension_questions'),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const explanationsRelations = relations(explanations, ({ one }) => ({
  file: one(files, {
    fields: [explanations.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [explanations.userId],
    references: [users.id],
  }),
}));
