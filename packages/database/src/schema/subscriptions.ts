import { pgTable, uuid, varchar, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

import { relations } from 'drizzle-orm';
import { subscriptionTierEnum } from './enums';
import { users } from './users';
import { payments } from './payments';

export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'expired', 'trial']);


export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  plan: subscriptionTierEnum('plan').default('free').notNull(),
  status: subscriptionStatusEnum('status').default('trial').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  monthlyFileLimit: integer('monthly_file_limit').default(5).notNull(),
  monthlyQuestionLimit: integer('monthly_question_limit').default(100).notNull(),
  filesUsedThisMonth: integer('files_used_this_month').default(0).notNull(),
  questionsUsedThisMonth: integer('questions_used_this_month').default(0).notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).defaultNow().notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).defaultNow().notNull(),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  payments: many(payments),
}));


// Re-declare the fields as varchar for safety since stripe uses IDs like sub_... or cus_...
// Let's modify stripeCustomerId and stripeSubscriptionId to varchar in replacing file content if needed, but since it is a new file I'll write it correctly directly.
