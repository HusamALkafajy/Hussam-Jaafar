import { pgTable, uuid, varchar, integer, decimal, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { files } from './files';
import { users } from './users';
import { questions } from './questions';

export const examDifficultyEnum = pgEnum('exam_difficulty', ['easy', 'medium', 'hard', 'mixed']);
export const examStatusEnum = pgEnum('exam_status', ['draft', 'active', 'completed']);

export const exams = pgTable('exams', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  difficulty: examDifficultyEnum('difficulty').default('medium').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  timeLimitMinutes: integer('time_limit_minutes'),
  status: examStatusEnum('status').default('draft').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  score: decimal('score', { precision: 5, scale: 2 }), // e.g. 95.50
  strengthAnalysis: jsonb('strength_analysis'),
  weaknessAnalysis: jsonb('weakness_analysis'),
  studyPlan: jsonb('study_plan'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const examsRelations = relations(exams, ({ one, many }) => ({
  file: one(files, {
    fields: [exams.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [exams.userId],
    references: [users.id],
  }),
  questions: many(questions),
}));
