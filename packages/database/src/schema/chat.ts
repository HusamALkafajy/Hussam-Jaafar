import { pgTable, uuid, varchar, integer, timestamp, pgEnum, text, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { files } from './files';
import { users } from './users';

export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant']);

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  messageCount: integer('message_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  role: chatMessageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  references: jsonb('references'), // array of { page: number, text: string }
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  file: one(files, {
    fields: [chatSessions.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));
