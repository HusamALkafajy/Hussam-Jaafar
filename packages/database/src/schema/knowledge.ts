import { pgTable, uuid, varchar, text, timestamp, jsonb, real, index, uniqueIndex, check, pgEnum } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { files } from './files';
import { documentVersions } from './document_engine';

export const kgNodeTypeEnum = pgEnum('kg_node_type', [
  'Concept', 'Definition', 'Rule', 'Algorithm', 'Formula', 'Example', 'Term'
]);

export const kgEdgeTypeEnum = pgEnum('kg_edge_type', [
  'DEFINES', 'EXEMPLIFIES', 'DEPENDS_ON', 'PREREQUISITE_OF', 'EXPLAINS', 'CONTRADICTS', 'BELONGS_TO'
]);

export const knowledgeNodes = pgTable('knowledge_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
  versionId: uuid('version_id'), // Will be linked during DocumentVersion publication
  deterministicHash: varchar('deterministic_hash', { length: 255 }).notNull(),
  nodeType: kgNodeTypeEnum('node_type').notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  content: text('content').notNull(),
  sourceChunkId: varchar('source_chunk_id', { length: 255 }),
  confidenceScore: real('confidence_score').default(1.0).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    versionHashIdx: uniqueIndex('idx_kn_version_hash').on(table.versionId, table.deterministicHash),
    fileIdx: index('idx_kn_file').on(table.fileId),
  };
});

export const knowledgeEdges = pgTable('knowledge_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceNodeId: uuid('source_node_id').references(() => knowledgeNodes.id, { onDelete: 'cascade' }).notNull(),
  targetNodeId: uuid('target_node_id').references(() => knowledgeNodes.id, { onDelete: 'cascade' }).notNull(),
  edgeType: kgEdgeTypeEnum('edge_type').notNull(),
  confidenceScore: real('confidence_score').default(1.0).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    sourceTargetIdx: uniqueIndex('idx_ke_source_target_type').on(table.sourceNodeId, table.targetNodeId, table.edgeType),
    sourceIdx: index('idx_ke_source').on(table.sourceNodeId),
    targetIdx: index('idx_ke_target').on(table.targetNodeId),
    checkNotSelf: check('check_ke_not_self', sql`${table.sourceNodeId} != ${table.targetNodeId}`)
  };
});

export const knowledgeNodesRelations = relations(knowledgeNodes, ({ one, many }) => ({
  file: one(files, { fields: [knowledgeNodes.fileId], references: [files.id] }),
  version: one(documentVersions, { fields: [knowledgeNodes.versionId], references: [documentVersions.id] }),
  sourceEdges: many(knowledgeEdges, { relationName: 'source_node' }),
  targetEdges: many(knowledgeEdges, { relationName: 'target_node' }),
}));

export const knowledgeEdgesRelations = relations(knowledgeEdges, ({ one }) => ({
  source: one(knowledgeNodes, { fields: [knowledgeEdges.sourceNodeId], references: [knowledgeNodes.id], relationName: 'source_node' }),
  target: one(knowledgeNodes, { fields: [knowledgeEdges.targetNodeId], references: [knowledgeNodes.id], relationName: 'target_node' }),
}));
