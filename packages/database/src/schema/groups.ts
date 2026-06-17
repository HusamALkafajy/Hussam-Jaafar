import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { files } from './files';

// ── Enums ──────────────────────────────────────────────────────────────────────
export const groupRoleEnum = pgEnum('group_role', ['owner', 'admin', 'member']);

// ── 1. Study Groups ───────────────────────────────────────────────────────────
export const studyGroups = pgTable('study_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  inviteCode: varchar('invite_code', { length: 12 }).notNull().unique(),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  maxMembers: integer('max_members').default(20).notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 2. Group Members ──────────────────────────────────────────────────────────
export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .references(() => studyGroups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: groupRoleEnum('role').default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Prevent duplicate memberships
    uniqueMembership: unique('unique_group_membership').on(table.groupId, table.userId),
  }),
);

// ── 3. Group Messages ─────────────────────────────────────────────────────────
export const groupMessages = pgTable('group_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .references(() => studyGroups.id, { onDelete: 'cascade' })
    .notNull(),
  senderId: uuid('sender_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 4. Group Shared Files ─────────────────────────────────────────────────────
export const groupSharedFiles = pgTable(
  'group_shared_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .references(() => studyGroups.id, { onDelete: 'cascade' })
      .notNull(),
    fileId: uuid('file_id')
      .references(() => files.id, { onDelete: 'cascade' })
      .notNull(),
    sharedByUserId: uuid('shared_by_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sharedAt: timestamp('shared_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // A file can only be shared once per group
    uniqueShare: unique('unique_group_file_share').on(table.groupId, table.fileId),
  }),
);

// ── Relational Definitions ────────────────────────────────────────────────────
export const studyGroupsRelations = relations(studyGroups, ({ one, many }) => ({
  owner: one(users, { fields: [studyGroups.ownerId], references: [users.id] }),
  members: many(groupMembers),
  messages: many(groupMessages),
  sharedFiles: many(groupSharedFiles),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(studyGroups, { fields: [groupMembers.groupId], references: [studyGroups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  group: one(studyGroups, { fields: [groupMessages.groupId], references: [studyGroups.id] }),
  sender: one(users, { fields: [groupMessages.senderId], references: [users.id] }),
}));

export const groupSharedFilesRelations = relations(groupSharedFiles, ({ one }) => ({
  group: one(studyGroups, { fields: [groupSharedFiles.groupId], references: [studyGroups.id] }),
  file: one(files, { fields: [groupSharedFiles.fileId], references: [files.id] }),
  sharedBy: one(users, { fields: [groupSharedFiles.sharedByUserId], references: [users.id] }),
}));
