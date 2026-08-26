import { pgTable, uuid, varchar, integer, timestamp, pgEnum, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { files } from './files';
import { users } from './users';

export const masteryLevelEnum = pgEnum('mastery_level', ['new', 'learning', 'reviewing', 'mastered']);

export const flashcardSets = pgTable('flashcard_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  originGraphVersion: varchar('origin_graph_version', { length: 255 }), // Added
  totalCards: integer('total_cards').default(0).notNull(),
  masteredCount: integer('mastered_count').default(0).notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const flashcards = pgTable('flashcards', {
  id: uuid('id').primaryKey().defaultRandom(),
  setId: uuid('set_id').references(() => flashcardSets.id, { onDelete: 'cascade' }).notNull(),
  front: text('front').notNull(),
  back: text('back').notNull(),
  cardType: varchar('card_type', { length: 100 }), // Added
  version: varchar('version', { length: 255 }), // Added for deterministic hash
  knowledgeNodeId: varchar('knowledge_node_id', { length: 255 }), // Added
  sourceReferences: text('source_references'), // Stored as JSON string
  reviewCount: integer('review_count').default(0).notNull(),
  masteryLevel: masteryLevelEnum('mastery_level').default('new').notNull(),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
  // SM-2 Spaced Repetition Algorithm state
  easeFactor: integer('ease_factor').default(250).notNull(), // Stored as integer (EF * 100) to avoid float precision issues. Default = 2.5 → 250
  interval: integer('interval').default(0).notNull(),        // Last computed interval in days
  repetitions: integer('repetitions').default(0).notNull(),  // Consecutive successful review streak
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const flashcardSetsRelations = relations(flashcardSets, ({ one, many }) => ({
  file: one(files, {
    fields: [flashcardSets.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [flashcardSets.userId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  set: one(flashcardSets, {
    fields: [flashcards.setId],
    references: [flashcardSets.id],
  }),
}));
