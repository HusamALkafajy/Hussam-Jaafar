import { pgTable, uuid, date, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * quiz_monthly_usage — canonical per-user UTC-calendar-month Quiz generation capacity table.
 *
 * Design:
 *   One row per (user_id, period_start) where period_start is the first day of
 *   the UTC calendar month (e.g. 2026-08-01). New months naturally produce new
 *   rows — no cron reset, no Stripe dependency, no rolling window.
 *
 * Atomic admission:
 *   INSERT … ON CONFLICT DO UPDATE … WHERE used_questions + requested <= limit
 *   is the single database statement that provides concurrent-safe admission.
 *   See QuizMonthlyUsageRepository for the executable implementation.
 *
 * Scope:
 *   This table tracks REQUESTED generation capacity consumed before an external
 *   AI provider attempt begins. It is NOT provider-token accounting.
 *   TokenCost, TokenAccountant, and QuotaInterceptor are entirely separate.
 *
 * ADR-008 / Q0 #2 Product Quota — Free Launch.
 */
export const quizMonthlyUsage = pgTable(
  'quiz_monthly_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /**
     * First day of the UTC calendar month this row represents.
     * Stored as DATE (no time component) in UTC.
     * Example: 2026-08-01 for the entire month of August 2026.
     */
    periodStart: date('period_start').notNull(),
    /**
     * Total requested generation capacity consumed this month.
     * Incremented atomically. Never decremented (consume-on-admission contract).
     */
    usedQuestions: integer('used_questions').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    /**
     * UNIQUE (user_id, period_start) — enforces one row per user per month.
     * This is the concurrency anchor: INSERT ON CONFLICT uses this constraint
     * to perform an atomic conditional upsert without a separate SELECT.
     */
    uniqueIndex('uq_quiz_monthly_usage_user_period').on(table.userId, table.periodStart),
  ],
);

export const quizMonthlyUsageRelations = relations(quizMonthlyUsage, ({ one }) => ({
  user: one(users, {
    fields: [quizMonthlyUsage.userId],
    references: [users.id],
  }),
}));
