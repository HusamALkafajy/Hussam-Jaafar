import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// This module represents the retained Prisma physical contract. Identifiers are
// intentionally PascalCase/case-sensitive because Prisma maps to these physical
// PostgreSQL objects. It must not be merged with similarly named snake_case
// StudyAI application tables.
export const workflowStatus = pgEnum('WorkflowStatus', ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'COMPENSATING']);
export const jobStatus = pgEnum('JobStatus', ['QUEUED', 'PROCESSING', 'DONE', 'RETRYING', 'FAILED']);
export const assetType = pgEnum('AssetType', ['DOCUMENT', 'VIDEO', 'WEBPAGE', 'TEXT']);
export const assetStatus = pgEnum('AssetStatus', ['UPLOADING', 'PROCESSING', 'READY', 'ERROR']);
export const eventStatus = pgEnum('EventStatus', ['PENDING', 'PUBLISHED', 'FAILED']);
export const jobExecutionStatus = pgEnum('JobExecutionStatus', ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER']);
export const workerStatus = pgEnum('WorkerStatus', ['STARTING', 'IDLE', 'PROCESSING', 'PAUSED', 'DRAINING', 'STOPPED', 'DEAD']);
export const uploadStatus = pgEnum('UploadStatus', ['PENDING', 'UPLOADING', 'COMPLETED', 'FAILED']);

const timestamp3 = (name: string) => timestamp(name, { precision: 3 });
const now = sql`CURRENT_TIMESTAMP`;

export const workflow = pgTable('Workflow', {
  id: text('id').primaryKey().notNull(),
  type: text('type').notNull(),
  status: workflowStatus('status').notNull(),
  payload: jsonb('payload'),
  error: text('error'),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
}, (table) => [index('Workflow_status_idx').on(table.status)]);

export const workflowJob = pgTable('WorkflowJob', {
  id: text('id').primaryKey().notNull(),
  workflowId: text('workflowId').notNull(),
  name: text('name').notNull(),
  status: jobStatus('status').notNull(),
  retryCount: integer('retryCount').default(0).notNull(),
  startedAt: timestamp3('startedAt'),
  completedAt: timestamp3('completedAt'),
}, (table) => [
  foreignKey({ name: 'WorkflowJob_workflowId_fkey', columns: [table.workflowId], foreignColumns: [workflow.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const workflowEvent = pgTable('WorkflowEvent', {
  id: text('id').primaryKey().notNull(),
  workflowId: text('workflowId').notNull(),
  type: text('type').notNull(),
  timestamp: timestamp3('timestamp').default(now).notNull(),
  data: jsonb('data').notNull(),
}, (table) => [
  foreignKey({ name: 'WorkflowEvent_workflowId_fkey', columns: [table.workflowId], foreignColumns: [workflow.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const learningAsset = pgTable('LearningAsset', {
  id: text('id').primaryKey().notNull(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  type: assetType('type').notNull(),
  sourceUrl: text('sourceUrl'),
  content: text('content'),
  status: assetStatus('status').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
  deletedAt: timestamp3('deletedAt'),
}, (table) => [index('LearningAsset_userId_type_idx').on(table.userId, table.type)]);

export const assetCapability = pgTable('AssetCapability', {
  id: text('id').primaryKey().notNull(),
  assetId: text('assetId').notNull(),
  feature: text('feature').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
}, (table) => [
  foreignKey({ name: 'AssetCapability_assetId_fkey', columns: [table.assetId], foreignColumns: [learningAsset.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const prismaStudyPlan = pgTable('StudyPlan', {
  id: text('id').primaryKey().notNull(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  goal: text('goal').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
});

export const learningObjective = pgTable('LearningObjective', {
  id: text('id').primaryKey().notNull(),
  planId: text('planId').notNull(),
  topic: text('topic').notNull(),
  mastery: doublePrecision('mastery').default(0.0).notNull(),
  targetDate: timestamp3('targetDate'),
}, (table) => [
  foreignKey({ name: 'LearningObjective_planId_fkey', columns: [table.planId], foreignColumns: [prismaStudyPlan.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const assessment = pgTable('Assessment', {
  id: text('id').primaryKey().notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
  deletedAt: timestamp3('deletedAt'),
});

export const prismaQuestion = pgTable('Question', {
  id: text('id').primaryKey().notNull(),
  assessmentId: text('assessmentId').notNull(),
  text: text('text').notNull(),
  type: text('type').notNull(),
  answer: text('answer'),
}, (table) => [
  foreignKey({ name: 'Question_assessmentId_fkey', columns: [table.assessmentId], foreignColumns: [assessment.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const submission = pgTable('Submission', {
  id: text('id').primaryKey().notNull(),
  assessmentId: text('assessmentId').notNull(),
  userId: text('userId').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
}, (table) => [
  foreignKey({ name: 'Submission_assessmentId_fkey', columns: [table.assessmentId], foreignColumns: [assessment.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const assessmentResult = pgTable('AssessmentResult', {
  id: text('id').primaryKey().notNull(),
  assessmentId: text('assessmentId').notNull(),
  userId: text('userId').notNull(),
  score: doublePrecision('score').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
}, (table) => [
  foreignKey({ name: 'AssessmentResult_assessmentId_fkey', columns: [table.assessmentId], foreignColumns: [assessment.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const revisionSession = pgTable('RevisionSession', {
  id: text('id').primaryKey().notNull(),
  userId: text('userId').notNull(),
  startedAt: timestamp3('startedAt').default(now).notNull(),
  endedAt: timestamp3('endedAt'),
  version: integer('version').default(1).notNull(),
});

export const revisionItem = pgTable('RevisionItem', {
  id: text('id').primaryKey().notNull(),
  sessionId: text('sessionId').notNull(),
  targetId: text('targetId').notNull(),
  recall: doublePrecision('recall').notNull(),
}, (table) => [
  foreignKey({ name: 'RevisionItem_sessionId_fkey', columns: [table.sessionId], foreignColumns: [revisionSession.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const revisionSchedule = pgTable('RevisionSchedule', {
  id: text('id').primaryKey().notNull(),
  sessionId: text('sessionId').notNull(),
  nextDate: timestamp3('nextDate').notNull(),
  interval: integer('interval').notNull(),
}, (table) => [
  foreignKey({ name: 'RevisionSchedule_sessionId_fkey', columns: [table.sessionId], foreignColumns: [revisionSession.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const prismaAnalyticsEvent = pgTable('AnalyticsEvent', {
  id: text('id').primaryKey().notNull(),
  type: text('type').notNull(),
  userId: text('userId').notNull(),
  payload: jsonb('payload').notNull(),
  timestamp: timestamp3('timestamp').default(now).notNull(),
});

export const analyticsSnapshot = pgTable('AnalyticsSnapshot', {
  id: text('id').primaryKey().notNull(),
  userId: text('userId').notNull(),
  metrics: jsonb('metrics').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
});

export const identityContext = pgTable('IdentityContext', {
  id: text('id').primaryKey().notNull(),
  userId: text('userId').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
  deletedAt: timestamp3('deletedAt'),
}, (table) => [uniqueIndex('IdentityContext_userId_key').on(table.userId)]);

export const securityRole = pgTable('SecurityRole', {
  id: text('id').primaryKey().notNull(),
  identityId: text('identityId').notNull(),
  roleName: text('roleName').notNull(),
}, (table) => [
  foreignKey({ name: 'SecurityRole_identityId_fkey', columns: [table.identityId], foreignColumns: [identityContext.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const securityPermission = pgTable('SecurityPermission', {
  id: text('id').primaryKey().notNull(),
  identityId: text('identityId').notNull(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
}, (table) => [
  foreignKey({ name: 'SecurityPermission_identityId_fkey', columns: [table.identityId], foreignColumns: [identityContext.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const securityPolicy = pgTable('SecurityPolicy', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  rules: jsonb('rules').notNull(),
});

export const connectorInstance = pgTable('ConnectorInstance', {
  id: text('id').primaryKey().notNull(),
  provider: text('provider').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
});

export const connectorEvent = pgTable('ConnectorEvent', {
  id: text('id').primaryKey().notNull(),
  instanceId: text('instanceId').notNull(),
  eventType: text('eventType').notNull(),
  payload: jsonb('payload').notNull(),
  timestamp: timestamp3('timestamp').default(now).notNull(),
}, (table) => [
  foreignKey({ name: 'ConnectorEvent_instanceId_fkey', columns: [table.instanceId], foreignColumns: [connectorInstance.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const integrationConfig = pgTable('IntegrationConfig', {
  id: text('id').primaryKey().notNull(),
  instanceId: text('instanceId').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
}, (table) => [
  foreignKey({ name: 'IntegrationConfig_instanceId_fkey', columns: [table.instanceId], foreignColumns: [connectorInstance.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const recommendationContext = pgTable('RecommendationContext', {
  id: text('id').primaryKey().notNull(),
  userId: text('userId').notNull(),
  scope: text('scope').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
});

export const recommendationItem = pgTable('RecommendationItem', {
  id: text('id').primaryKey().notNull(),
  contextId: text('contextId').notNull(),
  targetId: text('targetId').notNull(),
  score: doublePrecision('score').notNull(),
}, (table) => [
  foreignKey({ name: 'RecommendationItem_contextId_fkey', columns: [table.contextId], foreignColumns: [recommendationContext.id] }).onDelete('cascade').onUpdate('cascade'),
]);

export const platformAsset = pgTable('PlatformAsset', {
  id: text('id').primaryKey().notNull(),
  key: text('key').notNull(),
  bucket: text('bucket').notNull(),
  size: integer('size').notNull(),
  mimeType: text('mimeType').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  deletedAt: timestamp3('deletedAt'),
}, (table) => [uniqueIndex('PlatformAsset_key_key').on(table.key)]);

export const prismaStoredEvent = pgTable('StoredEvent', {
  eventId: text('eventId').primaryKey().notNull(),
  aggregateId: text('aggregateId').notNull(),
  aggregateType: text('aggregateType').notNull(),
  eventType: text('eventType').notNull(),
  payload: jsonb('payload').notNull(),
  metadata: jsonb('metadata'),
  version: integer('version').default(1).notNull(),
  status: eventStatus('status').default('PENDING').notNull(),
  retryCount: integer('retryCount').default(0).notNull(),
  occurredAt: timestamp3('occurredAt').default(now).notNull(),
  publishedAt: timestamp3('publishedAt'),
}, (table) => [
  index('StoredEvent_aggregateId_idx').on(table.aggregateId),
  index('StoredEvent_status_occurredAt_idx').on(table.status, table.occurredAt),
]);

export const jobExecution = pgTable('JobExecution', {
  jobId: text('jobId').primaryKey().notNull(),
  jobType: text('jobType').notNull(),
  correlationId: text('correlationId'),
  causationId: text('causationId'),
  traceId: text('traceId'),
  workflowId: text('workflowId'),
  aggregateId: text('aggregateId'),
  status: jobExecutionStatus('status').default('PENDING').notNull(),
  priority: integer('priority').default(0).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  payloadHash: text('payloadHash'),
  errorMessage: text('errorMessage'),
  workerName: text('workerName'),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
  startedAt: timestamp3('startedAt'),
  completedAt: timestamp3('completedAt'),
  failedAt: timestamp3('failedAt'),
  duration: integer('duration'),
}, (table) => [
  index('JobExecution_status_createdAt_idx').on(table.status, table.createdAt),
  index('JobExecution_correlationId_idx').on(table.correlationId),
  index('JobExecution_jobType_idx').on(table.jobType),
]);

export const workerRuntime = pgTable('WorkerRuntime', {
  workerId: text('workerId').primaryKey().notNull(),
  workerName: text('workerName').notNull(),
  status: workerStatus('status').default('IDLE').notNull(),
  capabilities: jsonb('capabilities'),
  startedAt: timestamp3('startedAt').default(now).notNull(),
  lastHeartbeat: timestamp3('lastHeartbeat').default(now).notNull(),
  leaseExpiration: timestamp3('leaseExpiration').notNull(),
  currentJobId: text('currentJobId'),
  processedJobs: integer('processedJobs').default(0).notNull(),
  failedJobs: integer('failedJobs').default(0).notNull(),
  averageDuration: doublePrecision('averageDuration').default(0.0).notNull(),
  version: text('version').notNull(),
}, (table) => [
  index('WorkerRuntime_status_idx').on(table.status),
  index('WorkerRuntime_leaseExpiration_idx').on(table.leaseExpiration),
]);

export const prismaBinaryObjectMetadata = pgTable('BinaryObjectMetadata', {
  objectId: text('objectId').primaryKey().notNull(),
  storageProvider: text('storageProvider').notNull(),
  bucket: text('bucket').notNull(),
  storageKey: text('storageKey').notNull(),
  checksumSHA256: text('checksumSHA256'),
  contentLength: bigint('contentLength', { mode: 'bigint' }).notNull(),
  contentType: text('contentType').notNull(),
  version: integer('version').default(1).notNull(),
  encryptionState: text('encryptionState'),
  compressionState: text('compressionState'),
  retentionPolicy: text('retentionPolicy'),
  uploadStatus: uploadStatus('uploadStatus').default('PENDING').notNull(),
  createdAt: timestamp3('createdAt').default(now).notNull(),
  updatedAt: timestamp3('updatedAt').notNull(),
  deletedAt: timestamp3('deletedAt'),
}, (table) => [
  index('BinaryObjectMetadata_uploadStatus_idx').on(table.uploadStatus),
  index('BinaryObjectMetadata_checksumSHA256_idx').on(table.checksumSHA256),
  uniqueIndex('BinaryObjectMetadata_bucket_storageKey_key').on(table.bucket, table.storageKey),
]);
