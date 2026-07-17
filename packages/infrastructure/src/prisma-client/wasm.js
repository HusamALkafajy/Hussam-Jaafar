
Object.defineProperty(exports, "__esModule", { value: true });

const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  NotFoundError,
  getPrismaClient,
  sqltag,
  empty,
  join,
  raw,
  skip,
  Decimal,
  Debug,
  objectEnumValues,
  makeStrictEnum,
  Extensions,
  warnOnce,
  defineDmmfProperty,
  Public,
  getRuntime
} = require('./runtime/wasm.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError
Prisma.PrismaClientInitializationError = PrismaClientInitializationError
Prisma.PrismaClientValidationError = PrismaClientValidationError
Prisma.NotFoundError = NotFoundError
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = Extensions.getExtensionContext
Prisma.defineExtension = Extensions.defineExtension

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}





/**
 * Enums
 */
exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.WorkflowScalarFieldEnum = {
  id: 'id',
  type: 'type',
  status: 'status',
  payload: 'payload',
  error: 'error',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkflowJobScalarFieldEnum = {
  id: 'id',
  workflowId: 'workflowId',
  name: 'name',
  status: 'status',
  retryCount: 'retryCount',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.WorkflowEventScalarFieldEnum = {
  id: 'id',
  workflowId: 'workflowId',
  type: 'type',
  timestamp: 'timestamp',
  data: 'data'
};

exports.Prisma.LearningAssetScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  type: 'type',
  sourceUrl: 'sourceUrl',
  content: 'content',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.AssetCapabilityScalarFieldEnum = {
  id: 'id',
  assetId: 'assetId',
  feature: 'feature',
  enabled: 'enabled'
};

exports.Prisma.StudyPlanScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  goal: 'goal',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LearningObjectiveScalarFieldEnum = {
  id: 'id',
  planId: 'planId',
  topic: 'topic',
  mastery: 'mastery',
  targetDate: 'targetDate'
};

exports.Prisma.AssessmentScalarFieldEnum = {
  id: 'id',
  title: 'title',
  type: 'type',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.QuestionScalarFieldEnum = {
  id: 'id',
  assessmentId: 'assessmentId',
  text: 'text',
  type: 'type',
  answer: 'answer'
};

exports.Prisma.SubmissionScalarFieldEnum = {
  id: 'id',
  assessmentId: 'assessmentId',
  userId: 'userId',
  status: 'status',
  createdAt: 'createdAt'
};

exports.Prisma.AssessmentResultScalarFieldEnum = {
  id: 'id',
  assessmentId: 'assessmentId',
  userId: 'userId',
  score: 'score',
  createdAt: 'createdAt'
};

exports.Prisma.RevisionSessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  startedAt: 'startedAt',
  endedAt: 'endedAt',
  version: 'version'
};

exports.Prisma.RevisionItemScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  targetId: 'targetId',
  recall: 'recall'
};

exports.Prisma.RevisionScheduleScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  nextDate: 'nextDate',
  interval: 'interval'
};

exports.Prisma.AnalyticsEventScalarFieldEnum = {
  id: 'id',
  type: 'type',
  userId: 'userId',
  payload: 'payload',
  timestamp: 'timestamp'
};

exports.Prisma.AnalyticsSnapshotScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  metrics: 'metrics',
  createdAt: 'createdAt'
};

exports.Prisma.IdentityContextScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.SecurityRoleScalarFieldEnum = {
  id: 'id',
  identityId: 'identityId',
  roleName: 'roleName'
};

exports.Prisma.SecurityPermissionScalarFieldEnum = {
  id: 'id',
  identityId: 'identityId',
  action: 'action',
  resource: 'resource'
};

exports.Prisma.SecurityPolicyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  rules: 'rules'
};

exports.Prisma.ConnectorInstanceScalarFieldEnum = {
  id: 'id',
  provider: 'provider',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ConnectorEventScalarFieldEnum = {
  id: 'id',
  instanceId: 'instanceId',
  eventType: 'eventType',
  payload: 'payload',
  timestamp: 'timestamp'
};

exports.Prisma.IntegrationConfigScalarFieldEnum = {
  id: 'id',
  instanceId: 'instanceId',
  key: 'key',
  value: 'value'
};

exports.Prisma.RecommendationContextScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  scope: 'scope',
  createdAt: 'createdAt'
};

exports.Prisma.RecommendationItemScalarFieldEnum = {
  id: 'id',
  contextId: 'contextId',
  targetId: 'targetId',
  score: 'score'
};

exports.Prisma.PlatformAssetScalarFieldEnum = {
  id: 'id',
  key: 'key',
  bucket: 'bucket',
  size: 'size',
  mimeType: 'mimeType',
  createdAt: 'createdAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.StoredEventScalarFieldEnum = {
  eventId: 'eventId',
  aggregateId: 'aggregateId',
  aggregateType: 'aggregateType',
  eventType: 'eventType',
  payload: 'payload',
  metadata: 'metadata',
  version: 'version',
  status: 'status',
  retryCount: 'retryCount',
  occurredAt: 'occurredAt',
  publishedAt: 'publishedAt'
};

exports.Prisma.JobExecutionScalarFieldEnum = {
  jobId: 'jobId',
  jobType: 'jobType',
  correlationId: 'correlationId',
  causationId: 'causationId',
  traceId: 'traceId',
  workflowId: 'workflowId',
  aggregateId: 'aggregateId',
  status: 'status',
  priority: 'priority',
  attempts: 'attempts',
  payloadHash: 'payloadHash',
  errorMessage: 'errorMessage',
  workerName: 'workerName',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  failedAt: 'failedAt',
  duration: 'duration'
};

exports.Prisma.WorkerRuntimeScalarFieldEnum = {
  workerId: 'workerId',
  workerName: 'workerName',
  status: 'status',
  capabilities: 'capabilities',
  startedAt: 'startedAt',
  lastHeartbeat: 'lastHeartbeat',
  leaseExpiration: 'leaseExpiration',
  currentJobId: 'currentJobId',
  processedJobs: 'processedJobs',
  failedJobs: 'failedJobs',
  averageDuration: 'averageDuration',
  version: 'version'
};

exports.Prisma.BinaryObjectMetadataScalarFieldEnum = {
  objectId: 'objectId',
  storageProvider: 'storageProvider',
  bucket: 'bucket',
  storageKey: 'storageKey',
  checksumSHA256: 'checksumSHA256',
  contentLength: 'contentLength',
  contentType: 'contentType',
  version: 'version',
  encryptionState: 'encryptionState',
  compressionState: 'compressionState',
  retentionPolicy: 'retentionPolicy',
  uploadStatus: 'uploadStatus',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.WorkflowStatus = exports.$Enums.WorkflowStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  COMPENSATING: 'COMPENSATING'
};

exports.JobStatus = exports.$Enums.JobStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  RETRYING: 'RETRYING',
  FAILED: 'FAILED'
};

exports.AssetType = exports.$Enums.AssetType = {
  DOCUMENT: 'DOCUMENT',
  VIDEO: 'VIDEO',
  WEBPAGE: 'WEBPAGE',
  TEXT: 'TEXT'
};

exports.AssetStatus = exports.$Enums.AssetStatus = {
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  ERROR: 'ERROR'
};

exports.EventStatus = exports.$Enums.EventStatus = {
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED'
};

exports.JobExecutionStatus = exports.$Enums.JobExecutionStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  DEAD_LETTER: 'DEAD_LETTER'
};

exports.WorkerStatus = exports.$Enums.WorkerStatus = {
  STARTING: 'STARTING',
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  PAUSED: 'PAUSED',
  DRAINING: 'DRAINING',
  STOPPED: 'STOPPED',
  DEAD: 'DEAD'
};

exports.UploadStatus = exports.$Enums.UploadStatus = {
  PENDING: 'PENDING',
  UPLOADING: 'UPLOADING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

exports.Prisma.ModelName = {
  Workflow: 'Workflow',
  WorkflowJob: 'WorkflowJob',
  WorkflowEvent: 'WorkflowEvent',
  LearningAsset: 'LearningAsset',
  AssetCapability: 'AssetCapability',
  StudyPlan: 'StudyPlan',
  LearningObjective: 'LearningObjective',
  Assessment: 'Assessment',
  Question: 'Question',
  Submission: 'Submission',
  AssessmentResult: 'AssessmentResult',
  RevisionSession: 'RevisionSession',
  RevisionItem: 'RevisionItem',
  RevisionSchedule: 'RevisionSchedule',
  AnalyticsEvent: 'AnalyticsEvent',
  AnalyticsSnapshot: 'AnalyticsSnapshot',
  IdentityContext: 'IdentityContext',
  SecurityRole: 'SecurityRole',
  SecurityPermission: 'SecurityPermission',
  SecurityPolicy: 'SecurityPolicy',
  ConnectorInstance: 'ConnectorInstance',
  ConnectorEvent: 'ConnectorEvent',
  IntegrationConfig: 'IntegrationConfig',
  RecommendationContext: 'RecommendationContext',
  RecommendationItem: 'RecommendationItem',
  PlatformAsset: 'PlatformAsset',
  StoredEvent: 'StoredEvent',
  JobExecution: 'JobExecution',
  WorkerRuntime: 'WorkerRuntime',
  BinaryObjectMetadata: 'BinaryObjectMetadata'
};
/**
 * Create the Client
 */
const config = {
  "generator": {
    "name": "client",
    "provider": {
      "fromEnvVar": null,
      "value": "prisma-client-js"
    },
    "output": {
      "value": "C:\\Users\\Hussam\\Documents\\ViberDownloads\\studyai\\packages\\infrastructure\\src\\prisma-client",
      "fromEnvVar": null
    },
    "config": {
      "engineType": "library"
    },
    "binaryTargets": [
      {
        "fromEnvVar": null,
        "value": "windows",
        "native": true
      },
      {
        "fromEnvVar": null,
        "value": "linux-musl-openssl-3.0.x"
      }
    ],
    "previewFeatures": [
      "driverAdapters",
      "metrics",
      "tracing"
    ],
    "sourceFilePath": "C:\\Users\\Hussam\\Documents\\ViberDownloads\\studyai\\packages\\infrastructure\\prisma\\schema.prisma",
    "isCustomOutput": true
  },
  "relativeEnvPaths": {
    "rootEnvPath": null
  },
  "relativePath": "../../prisma",
  "clientVersion": "5.22.0",
  "engineVersion": "605197351a3c8bdd595af2d2a9bc3025bca48ea2",
  "datasourceNames": [
    "db"
  ],
  "activeProvider": "postgresql",
  "inlineDatasources": {
    "db": {
      "url": {
        "fromEnvVar": "DATABASE_URL",
        "value": null
      }
    }
  },
  "inlineSchema": "generator client {\n  provider        = \"prisma-client-js\"\n  output          = \"../src/prisma-client\"\n  previewFeatures = [\"driverAdapters\", \"tracing\", \"metrics\"]\n  binaryTargets   = [\"native\", \"linux-musl-openssl-3.0.x\"]\n}\n\ndatasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\n// -----------------------------------------------------------------------------\n// WORKFLOW AGGREGATE\n// -----------------------------------------------------------------------------\nmodel Workflow {\n  id        String         @id @default(uuid())\n  type      String\n  status    WorkflowStatus\n  payload   Json?\n  error     String?\n  version   Int            @default(1)\n  createdAt DateTime       @default(now())\n  updatedAt DateTime       @updatedAt\n\n  jobs   WorkflowJob[]\n  events WorkflowEvent[]\n\n  @@index([status])\n}\n\nmodel WorkflowJob {\n  id          String    @id @default(uuid())\n  workflowId  String\n  name        String\n  status      JobStatus\n  retryCount  Int       @default(0)\n  startedAt   DateTime?\n  completedAt DateTime?\n\n  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)\n}\n\nmodel WorkflowEvent {\n  id         String   @id @default(uuid())\n  workflowId String\n  type       String\n  timestamp  DateTime @default(now())\n  data       Json\n\n  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)\n}\n\nenum WorkflowStatus {\n  PENDING\n  RUNNING\n  COMPLETED\n  FAILED\n  COMPENSATING\n}\n\nenum JobStatus {\n  QUEUED\n  PROCESSING\n  DONE\n  RETRYING\n  FAILED\n}\n\n// -----------------------------------------------------------------------------\n// LEARNING AGGREGATE\n// -----------------------------------------------------------------------------\nmodel LearningAsset {\n  id        String      @id @default(uuid())\n  userId    String\n  title     String\n  type      AssetType\n  sourceUrl String?\n  content   String?     @db.Text\n  status    AssetStatus\n  createdAt DateTime    @default(now())\n  updatedAt DateTime    @updatedAt\n  deletedAt DateTime?\n\n  capabilities AssetCapability[]\n\n  @@index([userId, type])\n}\n\nmodel AssetCapability {\n  id      String  @id @default(uuid())\n  assetId String\n  feature String\n  enabled Boolean @default(true)\n\n  asset LearningAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)\n}\n\nenum AssetType {\n  DOCUMENT\n  VIDEO\n  WEBPAGE\n  TEXT\n}\n\nenum AssetStatus {\n  UPLOADING\n  PROCESSING\n  READY\n  ERROR\n}\n\n// -----------------------------------------------------------------------------\n// STUDY PLAN AGGREGATE\n// -----------------------------------------------------------------------------\nmodel StudyPlan {\n  id        String   @id @default(uuid())\n  userId    String\n  title     String\n  goal      String\n  version   Int      @default(1)\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  objectives LearningObjective[]\n}\n\nmodel LearningObjective {\n  id         String    @id @default(uuid())\n  planId     String\n  topic      String\n  mastery    Float     @default(0.0)\n  targetDate DateTime?\n  plan       StudyPlan @relation(fields: [planId], references: [id], onDelete: Cascade)\n}\n\n// -----------------------------------------------------------------------------\n// ASSESSMENT AGGREGATE\n// -----------------------------------------------------------------------------\nmodel Assessment {\n  id        String    @id @default(uuid())\n  title     String\n  type      String\n  version   Int       @default(1)\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @updatedAt\n  deletedAt DateTime?\n\n  questions   Question[]\n  submissions Submission[]\n  results     AssessmentResult[]\n}\n\nmodel Question {\n  id           String  @id @default(uuid())\n  assessmentId String\n  text         String\n  type         String\n  answer       String?\n\n  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)\n}\n\nmodel Submission {\n  id           String   @id @default(uuid())\n  assessmentId String\n  userId       String\n  status       String\n  createdAt    DateTime @default(now())\n\n  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)\n}\n\nmodel AssessmentResult {\n  id           String   @id @default(uuid())\n  assessmentId String\n  userId       String\n  score        Float\n  createdAt    DateTime @default(now())\n\n  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)\n}\n\n// -----------------------------------------------------------------------------\n// REVISION AGGREGATE\n// -----------------------------------------------------------------------------\nmodel RevisionSession {\n  id        String    @id @default(uuid())\n  userId    String\n  startedAt DateTime  @default(now())\n  endedAt   DateTime?\n  version   Int       @default(1)\n\n  items     RevisionItem[]\n  schedules RevisionSchedule[]\n}\n\nmodel RevisionItem {\n  id        String @id @default(uuid())\n  sessionId String\n  targetId  String\n  recall    Float\n\n  session RevisionSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)\n}\n\nmodel RevisionSchedule {\n  id        String   @id @default(uuid())\n  sessionId String\n  nextDate  DateTime\n  interval  Int\n\n  session RevisionSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)\n}\n\n// -----------------------------------------------------------------------------\n// ANALYTICS AGGREGATE\n// -----------------------------------------------------------------------------\nmodel AnalyticsEvent {\n  id        String   @id @default(uuid())\n  type      String\n  userId    String\n  payload   Json\n  timestamp DateTime @default(now())\n}\n\nmodel AnalyticsSnapshot {\n  id        String   @id @default(uuid())\n  userId    String\n  metrics   Json\n  createdAt DateTime @default(now())\n}\n\n// -----------------------------------------------------------------------------\n// SECURITY AGGREGATE\n// -----------------------------------------------------------------------------\nmodel IdentityContext {\n  id        String    @id @default(uuid())\n  userId    String    @unique\n  metadata  Json?\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @updatedAt\n  deletedAt DateTime?\n\n  roles       SecurityRole[]\n  permissions SecurityPermission[]\n}\n\nmodel SecurityRole {\n  id         String @id @default(uuid())\n  identityId String\n  roleName   String\n\n  identity IdentityContext @relation(fields: [identityId], references: [id], onDelete: Cascade)\n}\n\nmodel SecurityPermission {\n  id         String @id @default(uuid())\n  identityId String\n  action     String\n  resource   String\n\n  identity IdentityContext @relation(fields: [identityId], references: [id], onDelete: Cascade)\n}\n\nmodel SecurityPolicy {\n  id          String @id @default(uuid())\n  name        String\n  description String\n  rules       Json\n}\n\n// -----------------------------------------------------------------------------\n// INTEGRATION AGGREGATE\n// -----------------------------------------------------------------------------\nmodel ConnectorInstance {\n  id        String   @id @default(uuid())\n  provider  String\n  status    String\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  events  ConnectorEvent[]\n  configs IntegrationConfig[]\n}\n\nmodel ConnectorEvent {\n  id         String   @id @default(uuid())\n  instanceId String\n  eventType  String\n  payload    Json\n  timestamp  DateTime @default(now())\n\n  instance ConnectorInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)\n}\n\nmodel IntegrationConfig {\n  id         String @id @default(uuid())\n  instanceId String\n  key        String\n  value      String\n\n  instance ConnectorInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)\n}\n\n// -----------------------------------------------------------------------------\n// RECOMMENDATION AGGREGATE\n// -----------------------------------------------------------------------------\nmodel RecommendationContext {\n  id        String   @id @default(uuid())\n  userId    String\n  scope     String\n  createdAt DateTime @default(now())\n\n  items RecommendationItem[]\n}\n\nmodel RecommendationItem {\n  id        String @id @default(uuid())\n  contextId String\n  targetId  String\n  score     Float\n\n  context RecommendationContext @relation(fields: [contextId], references: [id], onDelete: Cascade)\n}\n\n// -----------------------------------------------------------------------------\n// ASSET AGGREGATE\n// -----------------------------------------------------------------------------\nmodel PlatformAsset {\n  id        String    @id @default(uuid())\n  key       String    @unique\n  bucket    String\n  size      Int\n  mimeType  String\n  createdAt DateTime  @default(now())\n  deletedAt DateTime?\n}\n\n// -----------------------------------------------------------------------------\n// EVENT STORE AGGREGATE (OUTBOX)\n// -----------------------------------------------------------------------------\nmodel StoredEvent {\n  eventId       String      @id @default(uuid())\n  aggregateId   String\n  aggregateType String\n  eventType     String\n  payload       Json\n  metadata      Json?\n  version       Int         @default(1)\n  status        EventStatus @default(PENDING)\n  retryCount    Int         @default(0)\n  occurredAt    DateTime    @default(now())\n  publishedAt   DateTime?\n\n  @@index([aggregateId])\n  @@index([status, occurredAt])\n}\n\nenum EventStatus {\n  PENDING\n  PUBLISHED\n  FAILED\n}\n\n// -----------------------------------------------------------------------------\n// BACKGROUND JOB HISTORY AGGREGATE\n// -----------------------------------------------------------------------------\nmodel JobExecution {\n  jobId         String             @id\n  jobType       String\n  correlationId String?\n  causationId   String?\n  traceId       String?\n  workflowId    String?\n  aggregateId   String?\n  status        JobExecutionStatus @default(PENDING)\n  priority      Int                @default(0)\n  attempts      Int                @default(0)\n  payloadHash   String?\n  errorMessage  String?\n  workerName    String?\n\n  createdAt   DateTime  @default(now())\n  updatedAt   DateTime  @updatedAt\n  startedAt   DateTime?\n  completedAt DateTime?\n  failedAt    DateTime?\n  duration    Int? // in milliseconds\n\n  @@index([status, createdAt])\n  @@index([correlationId])\n  @@index([jobType])\n}\n\nenum JobExecutionStatus {\n  PENDING\n  RUNNING\n  COMPLETED\n  FAILED\n  DEAD_LETTER\n}\n\n// -----------------------------------------------------------------------------\n// WORKER RUNTIME AGGREGATE\n// -----------------------------------------------------------------------------\nmodel WorkerRuntime {\n  workerId        String       @id\n  workerName      String\n  status          WorkerStatus @default(IDLE)\n  capabilities    Json?\n  startedAt       DateTime     @default(now())\n  lastHeartbeat   DateTime     @default(now())\n  leaseExpiration DateTime\n  currentJobId    String?\n  processedJobs   Int          @default(0)\n  failedJobs      Int          @default(0)\n  averageDuration Float        @default(0.0)\n  version         String\n\n  @@index([status])\n  @@index([leaseExpiration])\n}\n\nenum WorkerStatus {\n  STARTING\n  IDLE\n  PROCESSING\n  PAUSED\n  DRAINING\n  STOPPED\n  DEAD\n}\n\n// -----------------------------------------------------------------------------\n// INFRASTRUCTURE STORAGE (Binary Asset Platform)\n// -----------------------------------------------------------------------------\nmodel BinaryObjectMetadata {\n  objectId         String       @id @default(uuid())\n  storageProvider  String\n  bucket           String\n  storageKey       String\n  checksumSHA256   String?\n  contentLength    BigInt\n  contentType      String\n  version          Int          @default(1)\n  encryptionState  String?\n  compressionState String?\n  retentionPolicy  String?\n  uploadStatus     UploadStatus @default(PENDING)\n\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @updatedAt\n  deletedAt DateTime?\n\n  @@unique([bucket, storageKey])\n  @@index([uploadStatus])\n  @@index([checksumSHA256])\n}\n\nenum UploadStatus {\n  PENDING\n  UPLOADING\n  COMPLETED\n  FAILED\n}\n",
  "inlineSchemaHash": "4549d71be22682a447860697e72526016864c882324cc3589ae3444f53f7593e",
  "copyEngine": true
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"Workflow\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"WorkflowStatus\"},{\"name\":\"payload\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"error\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"version\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"jobs\",\"kind\":\"object\",\"type\":\"WorkflowJob\",\"relationName\":\"WorkflowToWorkflowJob\"},{\"name\":\"events\",\"kind\":\"object\",\"type\":\"WorkflowEvent\",\"relationName\":\"WorkflowToWorkflowEvent\"}],\"dbName\":null},\"WorkflowJob\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"workflowId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"JobStatus\"},{\"name\":\"retryCount\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"startedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"completedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"workflow\",\"kind\":\"object\",\"type\":\"Workflow\",\"relationName\":\"WorkflowToWorkflowJob\"}],\"dbName\":null},\"WorkflowEvent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"workflowId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"data\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"workflow\",\"kind\":\"object\",\"type\":\"Workflow\",\"relationName\":\"WorkflowToWorkflowEvent\"}],\"dbName\":null},\"LearningAsset\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"enum\",\"type\":\"AssetType\"},{\"name\":\"sourceUrl\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"content\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"AssetStatus\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"deletedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"capabilities\",\"kind\":\"object\",\"type\":\"AssetCapability\",\"relationName\":\"AssetCapabilityToLearningAsset\"}],\"dbName\":null},\"AssetCapability\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"assetId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"feature\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"enabled\",\"kind\":\"scalar\",\"type\":\"Boolean\"},{\"name\":\"asset\",\"kind\":\"object\",\"type\":\"LearningAsset\",\"relationName\":\"AssetCapabilityToLearningAsset\"}],\"dbName\":null},\"StudyPlan\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"goal\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"version\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"objectives\",\"kind\":\"object\",\"type\":\"LearningObjective\",\"relationName\":\"LearningObjectiveToStudyPlan\"}],\"dbName\":null},\"LearningObjective\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"planId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"topic\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"mastery\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"targetDate\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"plan\",\"kind\":\"object\",\"type\":\"StudyPlan\",\"relationName\":\"LearningObjectiveToStudyPlan\"}],\"dbName\":null},\"Assessment\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"title\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"version\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"deletedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"questions\",\"kind\":\"object\",\"type\":\"Question\",\"relationName\":\"AssessmentToQuestion\"},{\"name\":\"submissions\",\"kind\":\"object\",\"type\":\"Submission\",\"relationName\":\"AssessmentToSubmission\"},{\"name\":\"results\",\"kind\":\"object\",\"type\":\"AssessmentResult\",\"relationName\":\"AssessmentToAssessmentResult\"}],\"dbName\":null},\"Question\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"assessmentId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"text\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"answer\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"assessment\",\"kind\":\"object\",\"type\":\"Assessment\",\"relationName\":\"AssessmentToQuestion\"}],\"dbName\":null},\"Submission\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"assessmentId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"assessment\",\"kind\":\"object\",\"type\":\"Assessment\",\"relationName\":\"AssessmentToSubmission\"}],\"dbName\":null},\"AssessmentResult\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"assessmentId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"score\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"assessment\",\"kind\":\"object\",\"type\":\"Assessment\",\"relationName\":\"AssessmentToAssessmentResult\"}],\"dbName\":null},\"RevisionSession\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"startedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"endedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"version\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"items\",\"kind\":\"object\",\"type\":\"RevisionItem\",\"relationName\":\"RevisionItemToRevisionSession\"},{\"name\":\"schedules\",\"kind\":\"object\",\"type\":\"RevisionSchedule\",\"relationName\":\"RevisionScheduleToRevisionSession\"}],\"dbName\":null},\"RevisionItem\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"sessionId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"targetId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"recall\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"session\",\"kind\":\"object\",\"type\":\"RevisionSession\",\"relationName\":\"RevisionItemToRevisionSession\"}],\"dbName\":null},\"RevisionSchedule\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"sessionId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"nextDate\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"interval\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"session\",\"kind\":\"object\",\"type\":\"RevisionSession\",\"relationName\":\"RevisionScheduleToRevisionSession\"}],\"dbName\":null},\"AnalyticsEvent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"type\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"payload\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"AnalyticsSnapshot\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"metrics\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"IdentityContext\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"metadata\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"deletedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"roles\",\"kind\":\"object\",\"type\":\"SecurityRole\",\"relationName\":\"IdentityContextToSecurityRole\"},{\"name\":\"permissions\",\"kind\":\"object\",\"type\":\"SecurityPermission\",\"relationName\":\"IdentityContextToSecurityPermission\"}],\"dbName\":null},\"SecurityRole\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"identityId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"roleName\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"identity\",\"kind\":\"object\",\"type\":\"IdentityContext\",\"relationName\":\"IdentityContextToSecurityRole\"}],\"dbName\":null},\"SecurityPermission\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"identityId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"action\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"resource\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"identity\",\"kind\":\"object\",\"type\":\"IdentityContext\",\"relationName\":\"IdentityContextToSecurityPermission\"}],\"dbName\":null},\"SecurityPolicy\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"name\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"description\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"rules\",\"kind\":\"scalar\",\"type\":\"Json\"}],\"dbName\":null},\"ConnectorInstance\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"provider\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"events\",\"kind\":\"object\",\"type\":\"ConnectorEvent\",\"relationName\":\"ConnectorEventToConnectorInstance\"},{\"name\":\"configs\",\"kind\":\"object\",\"type\":\"IntegrationConfig\",\"relationName\":\"ConnectorInstanceToIntegrationConfig\"}],\"dbName\":null},\"ConnectorEvent\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"instanceId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"eventType\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"payload\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"instance\",\"kind\":\"object\",\"type\":\"ConnectorInstance\",\"relationName\":\"ConnectorEventToConnectorInstance\"}],\"dbName\":null},\"IntegrationConfig\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"instanceId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"key\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"value\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"instance\",\"kind\":\"object\",\"type\":\"ConnectorInstance\",\"relationName\":\"ConnectorInstanceToIntegrationConfig\"}],\"dbName\":null},\"RecommendationContext\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"userId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"scope\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"items\",\"kind\":\"object\",\"type\":\"RecommendationItem\",\"relationName\":\"RecommendationContextToRecommendationItem\"}],\"dbName\":null},\"RecommendationItem\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"contextId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"targetId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"score\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"context\",\"kind\":\"object\",\"type\":\"RecommendationContext\",\"relationName\":\"RecommendationContextToRecommendationItem\"}],\"dbName\":null},\"PlatformAsset\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"key\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"bucket\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"size\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"mimeType\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"deletedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"StoredEvent\":{\"fields\":[{\"name\":\"eventId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"aggregateId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"aggregateType\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"eventType\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"payload\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"metadata\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"version\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"EventStatus\"},{\"name\":\"retryCount\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"occurredAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"publishedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null},\"JobExecution\":{\"fields\":[{\"name\":\"jobId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"jobType\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"correlationId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"causationId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"traceId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"workflowId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"aggregateId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"JobExecutionStatus\"},{\"name\":\"priority\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"attempts\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"payloadHash\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"errorMessage\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"workerName\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"startedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"completedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"failedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"duration\",\"kind\":\"scalar\",\"type\":\"Int\"}],\"dbName\":null},\"WorkerRuntime\":{\"fields\":[{\"name\":\"workerId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"workerName\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"status\",\"kind\":\"enum\",\"type\":\"WorkerStatus\"},{\"name\":\"capabilities\",\"kind\":\"scalar\",\"type\":\"Json\"},{\"name\":\"startedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"lastHeartbeat\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"leaseExpiration\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"currentJobId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"processedJobs\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"failedJobs\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"averageDuration\",\"kind\":\"scalar\",\"type\":\"Float\"},{\"name\":\"version\",\"kind\":\"scalar\",\"type\":\"String\"}],\"dbName\":null},\"BinaryObjectMetadata\":{\"fields\":[{\"name\":\"objectId\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"storageProvider\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"bucket\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"storageKey\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"checksumSHA256\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"contentLength\",\"kind\":\"scalar\",\"type\":\"BigInt\"},{\"name\":\"contentType\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"version\",\"kind\":\"scalar\",\"type\":\"Int\"},{\"name\":\"encryptionState\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"compressionState\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"retentionPolicy\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"uploadStatus\",\"kind\":\"enum\",\"type\":\"UploadStatus\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"},{\"name\":\"deletedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\"}],\"dbName\":null}},\"enums\":{},\"types\":{}}")
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)
config.engineWasm = {
  getRuntime: () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    const loader = (await import('#wasm-engine-loader')).default
    const engine = (await loader).default
    return engine 
  }
}

config.injectableEdgeEnv = () => ({
  parsed: {
    DATABASE_URL: typeof globalThis !== 'undefined' && globalThis['DATABASE_URL'] || typeof process !== 'undefined' && process.env && process.env.DATABASE_URL || undefined
  }
})

if (typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined) {
  Debug.enable(typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined)
}

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)

