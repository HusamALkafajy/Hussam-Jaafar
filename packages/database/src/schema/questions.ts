import { pgTable, uuid, text, jsonb, boolean, integer, timestamp, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { exams } from './exams';

export const questionTypeEnum = pgEnum('question_type', ['mcq', 'true_false', 'fill_blank', 'essay', 'short']);
export const questionDifficultyEnum = pgEnum('question_difficulty', ['easy', 'medium', 'hard']);

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  examId: uuid('exam_id').references(() => exams.id, { onDelete: 'cascade' }).notNull(),
  type: questionTypeEnum('type').notNull(),
  questionText: text('question_text').notNull(),
  options: jsonb('options'), // array of strings for MCQ
  correctAnswer: text('correct_answer').notNull(),
  userAnswer: text('user_answer'),
  version: varchar('version', { length: 255 }), // Added for deterministic hash
  knowledgeNodeId: varchar('knowledge_node_id', { length: 255 }), // Added
  sourceReferences: text('source_references'), // Stored as JSON string
  isCorrect: boolean('is_correct'),
  explanation: text('explanation'),
  aiFeedback: text('ai_feedback'),    // Per-question personalized AI mini-lesson (populated after exam grading)
  difficulty: questionDifficultyEnum('difficulty').default('medium').notNull(),
  orderIndex: integer('order_index').notNull(),
  points: integer('points').default(1).notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
});

export const questionsRelations = relations(questions, ({ one }) => ({
  exam: one(exams, {
    fields: [questions.examId],
    references: [exams.id],
  }),
}));
