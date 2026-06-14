import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['student', 'teacher', 'parent', 'admin']);
export const authProviderEnum = pgEnum('auth_provider', ['email', 'google', 'apple']);
export const localeEnum = pgEnum('locale', ['ar', 'en']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'institution']);