import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { subscriptions } from './subscriptions';
import { subjects } from './subjects';
import { files } from './files';
import { exams } from './exams';
import { flashcardSets } from './flashcards';
import { chatSessions } from './chat';
import { payments } from './payments';
import { analytics } from './analytics';
import { activityLogs } from './analytics';
import { roleEnum, authProviderEnum, localeEnum, subscriptionTierEnum } from './enums';
import { groupMembers } from './groups';
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  role: roleEnum('role').default('student').notNull(),
  authProvider: authProviderEnum('auth_provider').default('email').notNull(),
  providerId: varchar('provider_id', { length: 255 }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  verificationToken: varchar('verification_token', { length: 255 }),
  resetToken: varchar('reset_token', { length: 255 }),
  resetTokenExpires: timestamp('reset_token_expires', { withTimezone: true }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }),
  locale: localeEnum('locale').default('en').notNull(),

  subscriptionTier: subscriptionTierEnum('subscription_tier').default('free').notNull(),

  // ── Denormalized Stripe billing fields (fast-path cache; subscriptions table is source of truth) ──
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  subjects: many(subjects),
  files: many(files),
  exams: many(exams),
  flashcardSets: many(flashcardSets),
  chatSessions: many(chatSessions),
  payments: many(payments),
  analytics: many(analytics),
  activityLogs: many(activityLogs),
  groupMembers: many(groupMembers),
}));
