import { pgTable, uuid, integer, decimal, timestamp, date, pgEnum, varchar, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const activityActionEnum = pgEnum('activity_action', [
  'login', 'logout', 'upload', 'exam', 'summary', 'explanation', 'chat', 'flashcard', 'payment', 'settings'
]);

export const analytics = pgTable('analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  filesUploaded: integer('files_uploaded').default(0).notNull(),
  examsTaken: integer('exams_taken').default(0).notNull(),
  questionsAnswered: integer('questions_answered').default(0).notNull(),
  correctAnswers: integer('correct_answers').default(0).notNull(),
  flashcardsReviewed: integer('flashcards_reviewed').default(0).notNull(),
  studyMinutes: integer('study_minutes').default(0).notNull(),
  avgScore: decimal('avg_score', { precision: 5, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: activityActionEnum('action').notNull(),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const analyticsRelations = relations(analytics, ({ one }) => ({
  user: one(users, {
    fields: [analytics.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const recommendationEventActionEnum = pgEnum('recommendation_event_action', [
  'displayed', 'clicked', 'accepted', 'dismissed', 'completed', 'ignored', 'expired'
]);

export const recommendationAnalytics = pgTable('recommendation_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recommendationId: uuid('recommendation_id'),
  ruleIdentifier: varchar('rule_identifier', { length: 255 }).notNull(),
  recommendationType: varchar('recommendation_type', { length: 100 }).notNull(),
  action: recommendationEventActionEnum('action').notNull(),
  context: jsonb('context'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const recommendationAnalyticsRelations = relations(recommendationAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [recommendationAnalytics.userId],
    references: [users.id],
  }),
}));
