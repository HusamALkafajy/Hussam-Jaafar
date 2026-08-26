import { pgTable, varchar, uuid, timestamp, integer, jsonb, pgEnum, bigint, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const uploadStatusEnum = pgEnum('upload_status', ['PENDING', 'COMPLETED', 'FAILED']);
export const eventStatusEnum = pgEnum('event_status', ['PENDING', 'PUBLISHED', 'FAILED']);

export const binaryObjectMetadata = pgTable('binary_object_metadata', {
  objectId: uuid('object_id').primaryKey().defaultRandom(),
  storageProvider: varchar('storage_provider', { length: 255 }).notNull(),
  bucket: varchar('bucket', { length: 255 }).notNull(),
  storageKey: varchar('storage_key', { length: 1024 }).notNull(),
  checksumSHA256: varchar('checksum_sha256', { length: 255 }),
  contentLength: bigint('content_length', { mode: 'number' }).notNull(),
  contentType: varchar('content_type', { length: 255 }).notNull(),
  version: integer('version').default(1).notNull(),
  encryptionState: varchar('encryption_state', { length: 255 }),
  compressionState: varchar('compression_state', { length: 255 }),
  retentionPolicy: varchar('retention_policy', { length: 255 }),
  uploadStatus: uploadStatusEnum('upload_status').default('PENDING').notNull(),
  
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
}, (table) => ({
  bucketKeyUnique: uniqueIndex('bucket_key_idx').on(table.bucket, table.storageKey),
  uploadStatusIdx: index('upload_status_idx').on(table.uploadStatus),
  checksumIdx: index('checksum_idx').on(table.checksumSHA256),
}));

export const storedEvents = pgTable('stored_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  aggregateId: varchar('aggregate_id', { length: 255 }).notNull(),
  aggregateType: varchar('aggregate_type', { length: 255 }).notNull(),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  payload: jsonb('payload').notNull(),
  metadata: jsonb('metadata'),
  version: integer('version').default(1).notNull(),
  status: eventStatusEnum('status').default('PENDING').notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  occurredAt: timestamp('occurred_at', { mode: 'date' }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
}, (table) => ({
  aggregateIdIdx: index('aggregate_id_idx').on(table.aggregateId),
  statusOccurredAtIdx: index('status_occurred_at_idx').on(table.status, table.occurredAt),
}));
