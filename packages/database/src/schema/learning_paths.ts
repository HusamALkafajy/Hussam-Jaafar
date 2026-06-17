import { pgTable, uuid, varchar, integer, decimal, timestamp, boolean, text, jsonb, pgEnum, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { files } from './files';

// Custom pgvector type for Drizzle (1536 dimensions for OpenAI/Gemini embeddings)
const pgVector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value !== 'string') return [];
    return value.replace(/[\[\]]/g, '').split(',').map(Number);
  }
});

// Enums
export const roadmapStatusEnum = pgEnum('roadmap_status', ['locked', 'active', 'completed']);
export const projectStatusEnum = pgEnum('project_status', ['pending', 'submitted', 'graded']);
export const gapSeverityEnum = pgEnum('gap_severity', ['low', 'medium', 'high']);

// 1. Learning Paths (High-Level Roadmaps)
export const learningPaths = pgTable('learning_paths', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  skillName: varchar('skill_name', { length: 255 }).notNull(),
  difficultyLevel: varchar('difficulty_level', { length: 100 }).notNull(), // beginner, intermediate, advanced
  endGoal: varchar('end_goal', { length: 1000 }).notNull(), // e.g. "Get Python Dev Job"
  dailyAvailableMinutes: integer('daily_available_minutes').default(30).notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  // ── Adaptive evaluation fields ──
  isAdaptive: boolean('is_adaptive').default(true).notNull(), // Opt-out of nightly cron evaluation
  lastEvaluatedAt: timestamp('last_evaluated_at', { withTimezone: true }),
  adaptationScore: integer('adaptation_score'),              // 0–100, last computed performance score
  adaptationNotes: text('adaptation_notes'),                 // Human-readable reason for last adaptation
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Learning Stages (Nodes/Milestones in a path)
export const learningStages = pgTable('learning_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  pathId: uuid('path_id').references(() => learningPaths.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  orderIndex: integer('order_index').notNull(),
  status: roadmapStatusEnum('status').default('locked').notNull(),
  prerequisites: jsonb('prerequisites').default([]), // List of prior stage IDs required
  estimatedHours: integer('estimated_hours').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Lessons (Tutor-generated learning material per stage)
export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id').references(() => learningStages.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(), // Markdown concept explanation
  isCompleted: boolean('is_completed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Stage Projects (Hands-on tasks/assignments)
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id').references(() => learningStages.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  starterCode: text('starter_code'),
  studentSubmission: text('student_submission'),
  feedbackText: text('feedback_text'),
  score: integer('score'), // Graded out of 100
  status: projectStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Certifications (Verifiable completion hashes)
export const certifications = pgTable('certifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  pathId: uuid('path_id').references(() => learningPaths.id, { onDelete: 'cascade' }).notNull(),
  certificateHash: varchar('certificate_hash', { length: 255 }).unique().notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  verificationUrl: varchar('verification_url', { length: 500 }).notNull(),
});

// 6. Knowledge Gaps (Conceptual weaknesses tracked dynamically)
export const knowledgeGaps = pgTable('knowledge_gaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  concept: varchar('concept', { length: 255 }).notNull(),
  stageId: uuid('stage_id').references(() => learningStages.id, { onDelete: 'cascade' }),
  severity: gapSeverityEnum('severity').notNull(),
  remedialAction: text('remedial_action'),
  isResolved: boolean('is_resolved').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// 7. AI Token Usage Logs (Operational metrics and billing calculations)
export const aiTokenUsage = pgTable('ai_token_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  agentType: varchar('agent_type', { length: 100 }).notNull(), // tutor, planner, coach, etc.
  model: varchar('model', { length: 100 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  costUSD: decimal('cost_usd', { precision: 10, scale: 6 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. Document Chunks (RAG Pipeline embeddings)
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  pageNumber: integer('page_number'),
  embedding: pgVector('embedding'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relational Definitions
export const learningPathsRelations = relations(learningPaths, ({ one, many }) => ({
  user: one(users, { fields: [learningPaths.userId], references: [users.id] }),
  stages: many(learningStages),
  certifications: many(certifications),
}));

export const learningStagesRelations = relations(learningStages, ({ one, many }) => ({
  path: one(learningPaths, { fields: [learningStages.pathId], references: [learningPaths.id] }),
  lessons: many(lessons),
  projects: many(projects),
  gaps: many(knowledgeGaps),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  stage: one(learningStages, { fields: [lessons.stageId], references: [learningStages.id] }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  stage: one(learningStages, { fields: [projects.stageId], references: [learningStages.id] }),
  user: one(users, { fields: [projects.userId], references: [users.id] }),
}));

export const certificationsRelations = relations(certifications, ({ one }) => ({
  user: one(users, { fields: [certifications.userId], references: [users.id] }),
  path: one(learningPaths, { fields: [certifications.pathId], references: [learningPaths.id] }),
}));

export const knowledgeGapsRelations = relations(knowledgeGaps, ({ one }) => ({
  user: one(users, { fields: [knowledgeGaps.userId], references: [users.id] }),
  stage: one(learningStages, { fields: [knowledgeGaps.stageId], references: [learningStages.id] }),
}));

export const aiTokenUsageRelations = relations(aiTokenUsage, ({ one }) => ({
  user: one(users, { fields: [aiTokenUsage.userId], references: [users.id] }),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  file: one(files, { fields: [documentChunks.fileId], references: [files.id] }),
}));
