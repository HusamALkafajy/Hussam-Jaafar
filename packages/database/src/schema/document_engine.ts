import { 
  pgTable, uuid, varchar, text, timestamp, jsonb, integer, uniqueIndex, index, check, pgEnum, foreignKey, unique
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { files } from './files';
import { users } from './users';

// ============================================================================
// ENUMS
// ============================================================================

export const nodeTypePgEnum = pgEnum('node_type', [
  'document', 'section', 'column', 'heading', 'paragraph', 'quote', 'code', 
  'list', 'list_item', 'table', 'table_row', 'table_cell', 'image', 'equation', 
  'video', 'audio', 'footnote', 'citation', 'callout', 'reference_list'
]);

export const relationshipTypeEnum = [
  'citation_target', 'footnote_target', 'internal_link'
] as const;

// ============================================================================
// SCHEMAS
// ============================================================================

// 1. DocumentVersion: Immutable versions for history & event sourcing
export const documentVersions = pgTable('document_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  commitMessage: text('commit_message'),
}, (table) => {
  return {
    fileVersionIdx: uniqueIndex('idx_doc_versions_file_version').on(table.fileId, table.versionNumber),
  };
});

// 2. DocumentNode: The core AST block (Tree structure)
export const documentNodes = pgTable('document_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  versionId: uuid('version_id').references(() => documentVersions.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id'), // Composite FK defined at table level
  nodeType: nodeTypePgEnum('node_type').notNull(),
  lexoRank: varchar('lexo_rank', { length: 255 }).notNull(),
  content: jsonb('content').notNull().default({}),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    // Unique constraint required to be the target of the composite FK
    idVersionUnique: unique('idx_doc_nodes_id_version').on(table.id, table.versionId),
    // Composite FK to guarantee cross-version isolation
    parentVersionFk: foreignKey({
      columns: [table.parentId, table.versionId],
      foreignColumns: [table.id, table.versionId],
      name: 'fk_parent_version'
    }).onDelete('cascade'),
    // Crucial index for virtualized Reader fetching
    parentRankIdx: index('idx_doc_nodes_parent_rank').on(table.fileId, table.versionId, table.parentId, table.lexoRank),
    typeIdx: index('idx_doc_nodes_type').on(table.nodeType),
    // Ensure no duplicate ranks among siblings (ignores NULL parent_id)
    uniqueRankPerParent: uniqueIndex('idx_doc_nodes_unique_sibling_rank').on(table.parentId, table.lexoRank),
    // Ensure no duplicate ranks for root nodes
    uniqueRootRank: uniqueIndex('idx_doc_nodes_root_rank').on(table.fileId, table.versionId, table.lexoRank).where(sql`${table.parentId} IS NULL`),
    // Check constraints
    checkLexoRank: check('check_lexo_rank_not_empty', sql`length(${table.lexoRank}) > 0`),
    checkNotSelfParent: check('check_not_self_parent', sql`${table.id} != ${table.parentId}`)
  };
});

// 3. NodeRelationship: Graph edges for cross-references
export const nodeRelationships = pgTable('node_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceNodeId: uuid('source_node_id').references(() => documentNodes.id, { onDelete: 'cascade' }).notNull(),
  targetNodeId: uuid('target_node_id').references(() => documentNodes.id, { onDelete: 'cascade' }).notNull(),
  relationshipType: varchar('relationship_type', { length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    sourceIdx: index('idx_node_rel_source').on(table.sourceNodeId),
    targetIdx: index('idx_node_rel_target').on(table.targetNodeId),
    uniqueRel: uniqueIndex('idx_node_rel_unique').on(table.sourceNodeId, table.targetNodeId, table.relationshipType),
    checkNotSelf: check('check_rel_not_self', sql`${table.sourceNodeId} != ${table.targetNodeId}`)
  };
});

// 4. Annotation: User overlays (Highlights, Comments)
export const annotations = pgTable('annotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  nodeId: uuid('node_id').references(() => documentNodes.id, { onDelete: 'cascade' }).notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
  exactText: text('exact_text').notNull(),
  color: varchar('color', { length: 50 }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userFileIdx: index('idx_ann_user_file').on(table.userId, table.fileId),
    nodeIdx: index('idx_ann_node').on(table.nodeId),
    checkOffsets: check('check_ann_offsets_positive', sql`${table.startOffset} >= 0 AND ${table.startOffset} < ${table.endOffset}`)
  };
});

// 5. Bookmark: User navigation saves
export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  nodeId: uuid('node_id').references(() => documentNodes.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userFileIdx: index('idx_bmk_user_file').on(table.userId, table.fileId),
    uniqueBmk: uniqueIndex('idx_bmk_unique_user_node').on(table.userId, table.nodeId),
  };
});

// 6. ProcessingSession: Replaces monolithic worker jobs for Map-Reduce orchestration
export const processingSessions = pgTable('processing_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  totalChunks: integer('total_chunks').notNull().default(0),
  completedChunks: integer('completed_chunks').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. ProcessingCheckpoint: Map-Reduce child job state
export const processingCheckpoints = pgTable('processing_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => processingSessions.id, { onDelete: 'cascade' }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  startPage: integer('start_page').notNull(),
  endPage: integer('end_page').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  extractedAst: jsonb('extracted_ast'),
  errorMessage: text('error_message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    sessionChunkIdx: uniqueIndex('idx_chkpt_session_chunk').on(table.sessionId, table.chunkIndex),
  };
});

// 8. DocumentAsset: Images and Figures
export const documentAssets = pgTable('document_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  nodeId: uuid('node_id').references(() => documentNodes.id, { onDelete: 'set null' }),
  assetType: varchar('asset_type', { length: 50 }).notNull(),
  storageUrl: text('storage_url').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: integer('size_bytes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const documentVersionsRelations = relations(documentVersions, ({ one, many }) => ({
  file: one(files, { fields: [documentVersions.fileId], references: [files.id] }),
  nodes: many(documentNodes),
}));

export const documentNodesRelations = relations(documentNodes, ({ one, many }) => ({
  file: one(files, { fields: [documentNodes.fileId], references: [files.id] }),
  version: one(documentVersions, { fields: [documentNodes.versionId], references: [documentVersions.id] }),
  parent: one(documentNodes, { fields: [documentNodes.parentId], references: [documentNodes.id], relationName: 'parent_child' }),
  children: many(documentNodes, { relationName: 'parent_child' }),
  sourceRelationships: many(nodeRelationships, { relationName: 'source_rel' }),
  targetRelationships: many(nodeRelationships, { relationName: 'target_rel' }),
  annotations: many(annotations),
  bookmarks: many(bookmarks),
  assets: many(documentAssets),
}));

export const nodeRelationshipsRelations = relations(nodeRelationships, ({ one }) => ({
  source: one(documentNodes, { fields: [nodeRelationships.sourceNodeId], references: [documentNodes.id], relationName: 'source_rel' }),
  target: one(documentNodes, { fields: [nodeRelationships.targetNodeId], references: [documentNodes.id], relationName: 'target_rel' }),
}));
