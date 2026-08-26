import { pgTable, uuid, varchar, integer, decimal, timestamp, pgEnum, jsonb, boolean } from 'drizzle-orm/pg-core';
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
  originGraphVersion: varchar('origin_graph_version', { length: 255 }), // Added for deterministic tracking
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
  adaptiveMode: boolean('adaptive_mode').default(false).notNull(), // True when student requested adaptive follow-up questions
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // PR1.2 Batch 1: Evaluation concurrency foundation.
  // evaluationVersion: Monotonically incrementing fencing token. Each successful claim
  //   atomically increments this value. Workers hold their claimed version and must
  //   present it on final commit to prove they still own the evaluation slot.
  //   NOT NULL to avoid NULL + 1 = NULL silent failures in DB arithmetic.
  evaluationVersion: integer('evaluation_version').default(0).notNull(),
  // evaluationLockedAt: Timestamp at which the current evaluation lease was acquired.
  //   NULL = no active or prior evaluation claim.
  //   Non-null = a worker currently holds (or held) this slot.
  //   A claim older than 5 minutes is considered stale and eligible for reclamation.
  evaluationLockedAt: timestamp('evaluation_locked_at', { withTimezone: true }),
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
