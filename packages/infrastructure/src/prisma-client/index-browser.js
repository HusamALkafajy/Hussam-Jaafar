
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


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

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

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
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
