# Prisma-to-Drizzle Physical Ownership Inventory

## 1. Scope and evidence baseline

- Authorized branch: `hardening/p0-reconstruction-5573fd1b-v2`
- Evidence baseline: `910f7b17e0fafa0ae1be21d4cc08b6b58f52b2a4`
- Authoritative decision: `docs/DATABASE_MIGRATION_ORCHESTRATION_DECISION.md`
- Physical source of truth for this inventory:
  `packages/infrastructure/prisma/migrations/20260706214228_init_schema/migration.sql`
- Runtime mapping source:
  `packages/infrastructure/prisma/schema.prisma`

The physical SQL is authoritative when it differs from a Prisma model
annotation. In particular, Prisma client-side `@default(uuid())` and
`@updatedAt` behavior do **not** imply a PostgreSQL UUID default or update
trigger: the initial SQL contains neither. The transfer must preserve the
physical SQL contract rather than silently strengthen or alter it.

This inventory accounts for every top-level object created by the Prisma initial
migration exactly once: 8 enums and 30 public tables. It also records all 14
named indexes and 14 named foreign keys owned by those tables.

## 2. Classification summary

| Disposition | Count | Objects |
| --- | ---: | --- |
| RETAIN — CREATE UNDER DRIZZLE | 32 | 6 enums and 26 tables listed below |
| CONCEPTUAL DUPLICATE — KEEP AS DISTINCT PHYSICAL OBJECT | 6 | `EventStatus`, `UploadStatus`, `StudyPlan`, `Question`, `StoredEvent`, `BinaryObjectMetadata` |
| RETAIN — EXACT OBJECT ALREADY DRIZZLE OWNED | 0 | None; PostgreSQL names/contracts differ in every related case. |
| RETAIN — EXISTING OBJECT REQUIRES SAFE ADOPTION | 0 as a baseline classification | Any exact pre-existing instance of a retained object is handled by the migration's adoption branch; it is not a Drizzle-owned baseline object. |
| RUNTIME MODEL ONLY — MAP TO EXISTING DRIZZLE OBJECT | 0 | None. |
| RETIRE | 0 | None. |
| AMBIGUOUS | 0 | None. |

Every retained table is needed by an active Prisma repository, service, worker,
queue, storage path, outbox, health check, or by a relation required by one of
those active models. The composition root in
`packages/infrastructure/src/composition/bootstrap.ts` registers the Prisma
repositories and services. Absence of a direct call in one source file is not
treated as a retirement basis.

## 3. Complete enum inventory

All names are case-sensitive, public-schema PostgreSQL type names.

| Prisma enum / physical object | Exact members in order | Existing Drizzle equivalent | Runtime evidence | Final disposition |
| --- | --- | --- | --- | --- |
| `WorkflowStatus` / `public."WorkflowStatus"` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `COMPENSATING` | Absent | `PrismaWorkflowRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `JobStatus` / `public."JobStatus"` | `QUEUED`, `PROCESSING`, `DONE`, `RETRYING`, `FAILED` | Absent | `WorkflowJob` relation/model | RETAIN — CREATE UNDER DRIZZLE |
| `AssetType` / `public."AssetType"` | `DOCUMENT`, `VIDEO`, `WEBPAGE`, `TEXT` | Absent | `PrismaLearningRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `AssetStatus` / `public."AssetStatus"` | `UPLOADING`, `PROCESSING`, `READY`, `ERROR` | Absent | `PrismaLearningRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `EventStatus` / `public."EventStatus"` | `PENDING`, `PUBLISHED`, `FAILED` | Related `public.event_status`, but different case/name and `stored_events` contract | `PrismaEventOutbox`, `HealthPlatform` | CONCEPTUAL DUPLICATE — KEEP AS DISTINCT PHYSICAL OBJECT |
| `JobExecutionStatus` / `public."JobExecutionStatus"` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD_LETTER` | Absent | `OutboxJobDispatcher`, BullMQ worker adapter | RETAIN — CREATE UNDER DRIZZLE |
| `WorkerStatus` / `public."WorkerStatus"` | `STARTING`, `IDLE`, `PROCESSING`, `PAUSED`, `DRAINING`, `STOPPED`, `DEAD` | Absent | `WorkerRuntimeEngine`, `PrismaLeaseManager`, health | RETAIN — CREATE UNDER DRIZZLE |
| `UploadStatus` / `public."UploadStatus"` | `PENDING`, `UPLOADING`, `COMPLETED`, `FAILED` | Related `public.upload_status` lacks `UPLOADING` and backs another table | `ObjectStoragePlatform`, `UploadPipeline` | CONCEPTUAL DUPLICATE — KEEP AS DISTINCT PHYSICAL OBJECT |

## 4. Complete table inventory

All table and column identifiers shown below are quoted/case-sensitive
PostgreSQL identifiers in schema `public`. `t3` means `TIMESTAMP(3) WITHOUT
TIME ZONE`; no table in this contract has a database UUID default or an update
trigger. `PK(x)` is a named primary key; named indexes and foreign keys are
listed in Sections 5 and 6.

| Prisma model / physical table | Exact physical columns, type, nullability, default | PK / unique | Existing Drizzle equivalent and runtime evidence | Final disposition |
| --- | --- | --- | --- | --- |
| `Workflow` / `"Workflow"` | `id text NN`; `type text NN`; `status "WorkflowStatus" NN`; `payload jsonb`; `error text`; `version integer NN D=1`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN` | `Workflow_pkey(id)` | Absent; `PrismaWorkflowRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `WorkflowJob` / `"WorkflowJob"` | `id text NN`; `workflowId text NN`; `name text NN`; `status "JobStatus" NN`; `retryCount integer NN D=0`; `startedAt t3`; `completedAt t3` | `WorkflowJob_pkey(id)` | Absent; workflow relations | RETAIN — CREATE UNDER DRIZZLE |
| `WorkflowEvent` / `"WorkflowEvent"` | `id text NN`; `workflowId text NN`; `type text NN`; `timestamp t3 NN D=CURRENT_TIMESTAMP`; `data jsonb NN` | `WorkflowEvent_pkey(id)` | Absent; workflow relations | RETAIN — CREATE UNDER DRIZZLE |
| `LearningAsset` / `"LearningAsset"` | `id text NN`; `userId text NN`; `title text NN`; `type "AssetType" NN`; `sourceUrl text`; `content text`; `status "AssetStatus" NN`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN`; `deletedAt t3` | `LearningAsset_pkey(id)` | Absent; `PrismaLearningRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `AssetCapability` / `"AssetCapability"` | `id text NN`; `assetId text NN`; `feature text NN`; `enabled boolean NN D=true` | `AssetCapability_pkey(id)` | Absent; learning-asset relation | RETAIN — CREATE UNDER DRIZZLE |
| `StudyPlan` / `"StudyPlan"` | `id text NN`; `userId text NN`; `title text NN`; `goal text NN`; `version integer NN D=1`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN` | `StudyPlan_pkey(id)` | Related `study_plans` has UUID/snake-case/different columns; `PrismaStudyPlanRepository` | CONCEPTUAL DUPLICATE — KEEP AS DISTINCT PHYSICAL OBJECT |
| `LearningObjective` / `"LearningObjective"` | `id text NN`; `planId text NN`; `topic text NN`; `mastery double precision NN D=0.0`; `targetDate t3` | `LearningObjective_pkey(id)` | Absent; study-plan relation | RETAIN — CREATE UNDER DRIZZLE |
| `Assessment` / `"Assessment"` | `id text NN`; `title text NN`; `type text NN`; `version integer NN D=1`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN`; `deletedAt t3` | `Assessment_pkey(id)` | Absent; `PrismaAssessmentRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `Question` / `"Question"` | `id text NN`; `assessmentId text NN`; `text text NN`; `type text NN`; `answer text` | `Question_pkey(id)` | Related `questions` has UUID/snake-case/different columns/enums; assessment relation | CONCEPTUAL DUPLICATE — KEEP AS DISTINCT PHYSICAL OBJECT |
| `Submission` / `"Submission"` | `id text NN`; `assessmentId text NN`; `userId text NN`; `status text NN`; `createdAt t3 NN D=CURRENT_TIMESTAMP` | `Submission_pkey(id)` | Absent; assessment relation | RETAIN — CREATE UNDER DRIZZLE |
| `AssessmentResult` / `"AssessmentResult"` | `id text NN`; `assessmentId text NN`; `userId text NN`; `score double precision NN`; `createdAt t3 NN D=CURRENT_TIMESTAMP` | `AssessmentResult_pkey(id)` | Absent; assessment relation | RETAIN — CREATE UNDER DRIZZLE |
| `RevisionSession` / `"RevisionSession"` | `id text NN`; `userId text NN`; `startedAt t3 NN D=CURRENT_TIMESTAMP`; `endedAt t3`; `version integer NN D=1` | `RevisionSession_pkey(id)` | Absent; `PrismaRevisionRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `RevisionItem` / `"RevisionItem"` | `id text NN`; `sessionId text NN`; `targetId text NN`; `recall double precision NN` | `RevisionItem_pkey(id)` | Absent; revision-session relation | RETAIN — CREATE UNDER DRIZZLE |
| `RevisionSchedule` / `"RevisionSchedule"` | `id text NN`; `sessionId text NN`; `nextDate t3 NN`; `interval integer NN` | `RevisionSchedule_pkey(id)` | Absent; revision-session relation | RETAIN — CREATE UNDER DRIZZLE |
| `AnalyticsEvent` / `"AnalyticsEvent"` | `id text NN`; `type text NN`; `userId text NN`; `payload jsonb NN`; `timestamp t3 NN D=CURRENT_TIMESTAMP` | `AnalyticsEvent_pkey(id)` | Related snake-case analytics tables differ; `PrismaAnalyticsRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `AnalyticsSnapshot` / `"AnalyticsSnapshot"` | `id text NN`; `userId text NN`; `metrics jsonb NN`; `createdAt t3 NN D=CURRENT_TIMESTAMP` | `AnalyticsSnapshot_pkey(id)` | Related snake-case analytics tables differ; Prisma runtime model | RETAIN — CREATE UNDER DRIZZLE |
| `IdentityContext` / `"IdentityContext"` | `id text NN`; `userId text NN`; `metadata jsonb`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN`; `deletedAt t3` | `IdentityContext_pkey(id)`; unique `IdentityContext_userId_key(userId)` | Absent; `PrismaSecurityRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `SecurityRole` / `"SecurityRole"` | `id text NN`; `identityId text NN`; `roleName text NN` | `SecurityRole_pkey(id)` | Absent; identity relation | RETAIN — CREATE UNDER DRIZZLE |
| `SecurityPermission` / `"SecurityPermission"` | `id text NN`; `identityId text NN`; `action text NN`; `resource text NN` | `SecurityPermission_pkey(id)` | Absent; identity relation | RETAIN — CREATE UNDER DRIZZLE |
| `SecurityPolicy` / `"SecurityPolicy"` | `id text NN`; `name text NN`; `description text NN`; `rules jsonb NN` | `SecurityPolicy_pkey(id)` | Absent; runtime model/composition registration | RETAIN — CREATE UNDER DRIZZLE |
| `ConnectorInstance` / `"ConnectorInstance"` | `id text NN`; `provider text NN`; `status text NN`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN` | `ConnectorInstance_pkey(id)` | Absent; `PrismaIntegrationRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `ConnectorEvent` / `"ConnectorEvent"` | `id text NN`; `instanceId text NN`; `eventType text NN`; `payload jsonb NN`; `timestamp t3 NN D=CURRENT_TIMESTAMP` | `ConnectorEvent_pkey(id)` | Absent; connector relation | RETAIN — CREATE UNDER DRIZZLE |
| `IntegrationConfig` / `"IntegrationConfig"` | `id text NN`; `instanceId text NN`; `key text NN`; `value text NN` | `IntegrationConfig_pkey(id)` | Absent; connector relation | RETAIN — CREATE UNDER DRIZZLE |
| `RecommendationContext` / `"RecommendationContext"` | `id text NN`; `userId text NN`; `scope text NN`; `createdAt t3 NN D=CURRENT_TIMESTAMP` | `RecommendationContext_pkey(id)` | Absent; `PrismaRecommendationRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `RecommendationItem` / `"RecommendationItem"` | `id text NN`; `contextId text NN`; `targetId text NN`; `score double precision NN` | `RecommendationItem_pkey(id)` | Absent; recommendation relation | RETAIN — CREATE UNDER DRIZZLE |
| `PlatformAsset` / `"PlatformAsset"` | `id text NN`; `key text NN`; `bucket text NN`; `size integer NN`; `mimeType text NN`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `deletedAt t3` | `PlatformAsset_pkey(id)`; unique `PlatformAsset_key_key(key)` | Absent; `PrismaAssetRepository` | RETAIN — CREATE UNDER DRIZZLE |
| `StoredEvent` / `"StoredEvent"` | `eventId text NN`; `aggregateId text NN`; `aggregateType text NN`; `eventType text NN`; `payload jsonb NN`; `metadata jsonb`; `version integer NN D=1`; `status "EventStatus" NN D='PENDING'`; `retryCount integer NN D=0`; `occurredAt t3 NN D=CURRENT_TIMESTAMP`; `publishedAt t3` | `StoredEvent_pkey(eventId)` | Related `stored_events` has UUID/snake-case/different type names; `PrismaEventOutbox`, `HealthPlatform` | CONCEPTUAL DUPLICATE — KEEP AS DISTINCT PHYSICAL OBJECT |
| `JobExecution` / `"JobExecution"` | `jobId text NN`; `jobType text NN`; `correlationId text`; `causationId text`; `traceId text`; `workflowId text`; `aggregateId text`; `status "JobExecutionStatus" NN D='PENDING'`; `priority integer NN D=0`; `attempts integer NN D=0`; `payloadHash text`; `errorMessage text`; `workerName text`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN`; `startedAt t3`; `completedAt t3`; `failedAt t3`; `duration integer` | `JobExecution_pkey(jobId)` | Absent; `OutboxJobDispatcher`, BullMQ worker adapter | RETAIN — CREATE UNDER DRIZZLE |
| `WorkerRuntime` / `"WorkerRuntime"` | `workerId text NN`; `workerName text NN`; `status "WorkerStatus" NN D='IDLE'`; `capabilities jsonb`; `startedAt t3 NN D=CURRENT_TIMESTAMP`; `lastHeartbeat t3 NN D=CURRENT_TIMESTAMP`; `leaseExpiration t3 NN`; `currentJobId text`; `processedJobs integer NN D=0`; `failedJobs integer NN D=0`; `averageDuration double precision NN D=0.0`; `version text NN` | `WorkerRuntime_pkey(workerId)` | Absent; lifecycle, lease, BullMQ worker, health, API bootstrap | RETAIN — CREATE UNDER DRIZZLE |
| `BinaryObjectMetadata` / `"BinaryObjectMetadata"` | `objectId text NN`; `storageProvider text NN`; `bucket text NN`; `storageKey text NN`; `checksumSHA256 text`; `contentLength bigint NN`; `contentType text NN`; `version integer NN D=1`; `encryptionState text`; `compressionState text`; `retentionPolicy text`; `uploadStatus "UploadStatus" NN D='PENDING'`; `createdAt t3 NN D=CURRENT_TIMESTAMP`; `updatedAt t3 NN`; `deletedAt t3` | `BinaryObjectMetadata_pkey(objectId)`; unique `BinaryObjectMetadata_bucket_storageKey_key(bucket, storageKey)` | Related `binary_object_metadata` has UUID/snake-case/different enum/defaults; `ObjectStoragePlatform`, `UploadPipeline` | CONCEPTUAL DUPLICATE — KEEP AS DISTINCT PHYSICAL OBJECT |

## 5. Named index contract

| Table | Index |
| --- | --- |
| `"Workflow"` | `Workflow_status_idx(status)` |
| `"LearningAsset"` | `LearningAsset_userId_type_idx(userId, type)` |
| `"IdentityContext"` | unique `IdentityContext_userId_key(userId)` |
| `"PlatformAsset"` | unique `PlatformAsset_key_key(key)` |
| `"StoredEvent"` | `StoredEvent_aggregateId_idx(aggregateId)`; `StoredEvent_status_occurredAt_idx(status, occurredAt)` |
| `"JobExecution"` | `JobExecution_status_createdAt_idx(status, createdAt)`; `JobExecution_correlationId_idx(correlationId)`; `JobExecution_jobType_idx(jobType)` |
| `"WorkerRuntime"` | `WorkerRuntime_status_idx(status)`; `WorkerRuntime_leaseExpiration_idx(leaseExpiration)` |
| `"BinaryObjectMetadata"` | `BinaryObjectMetadata_uploadStatus_idx(uploadStatus)`; `BinaryObjectMetadata_checksumSHA256_idx(checksumSHA256)`; unique `BinaryObjectMetadata_bucket_storageKey_key(bucket, storageKey)` |

## 6. Named foreign-key contract

All actions are `ON DELETE CASCADE ON UPDATE CASCADE`.

| Constraint | Child column | Parent column |
| --- | --- | --- |
| `WorkflowJob_workflowId_fkey` | `"WorkflowJob".workflowId` | `"Workflow".id` |
| `WorkflowEvent_workflowId_fkey` | `"WorkflowEvent".workflowId` | `"Workflow".id` |
| `AssetCapability_assetId_fkey` | `"AssetCapability".assetId` | `"LearningAsset".id` |
| `LearningObjective_planId_fkey` | `"LearningObjective".planId` | `"StudyPlan".id` |
| `Question_assessmentId_fkey` | `"Question".assessmentId` | `"Assessment".id` |
| `Submission_assessmentId_fkey` | `"Submission".assessmentId` | `"Assessment".id` |
| `AssessmentResult_assessmentId_fkey` | `"AssessmentResult".assessmentId` | `"Assessment".id` |
| `RevisionItem_sessionId_fkey` | `"RevisionItem".sessionId` | `"RevisionSession".id` |
| `RevisionSchedule_sessionId_fkey` | `"RevisionSchedule".sessionId` | `"RevisionSession".id` |
| `SecurityRole_identityId_fkey` | `"SecurityRole".identityId` | `"IdentityContext".id` |
| `SecurityPermission_identityId_fkey` | `"SecurityPermission".identityId` | `"IdentityContext".id` |
| `ConnectorEvent_instanceId_fkey` | `"ConnectorEvent".instanceId` | `"ConnectorInstance".id` |
| `IntegrationConfig_instanceId_fkey` | `"IntegrationConfig".instanceId` | `"ConnectorInstance".id` |
| `RecommendationItem_contextId_fkey` | `"RecommendationItem".contextId` | `"RecommendationContext".id` |

## 7. Migration grouping plan

One additive ownership-transfer migration will treat the 38-object Prisma
contract as an indivisible unit:

1. classify the public schema as either **all 38 absent** or **all 38 present**;
2. reject every partial set before issuing DDL;
3. for an absent set, create the 8 enums, 30 tables, 14 indexes, and 14 foreign
   keys exactly as recorded above;
4. for a present set, verify exact object structure against this inventory,
   preserve objects and data, and permit the normal Drizzle migration journal to
   record adoption; and
5. leave `_prisma_migrations` untouched whether it is present or absent.

The migration must be transactional. It must not use `IF NOT EXISTS` as a
substitute for verification, write Prisma metadata, drop/recreate objects, or
merge conceptual duplicates. Drizzle schema source will represent the retained
objects where its PostgreSQL abstraction is exact; the migration SQL remains
authoritative for fail-closed adoption assertions.

## 8. Existing-database adoption behavior

| Classified state | Behavior |
| --- | --- |
| All 38 objects absent | Create the complete contract under Drizzle governance. |
| All 38 objects present and exact, with or without `_prisma_migrations` | Verify every required catalog property; preserve rows and metadata; allow normal Drizzle adoption. |
| Any subset present | Raise a precise error before mutation. |
| All objects present but one contract property differs | Raise a precise error before mutation. |
| Unknown database or insufficient catalog permissions | Stop before mutation. |

Production state is explicitly unknown. A separate read-only preflight must
classify each target database before the migration is invoked.

## 9. Required tests

- inventory coverage test tying the 38-object transfer plan to the Prisma SQL;
- empty-database creation and second-run no-op;
- exact WorkerRuntime and WorkerStatus catalog assertions;
- complete table/enum/index/foreign-key catalog assertions;
- exact all-present adoption with and without `_prisma_migrations`;
- partial-set, column, enum, index, default, nullability, and constraint
  mismatch rejection with pre/post fingerprints;
- Prisma runtime WorkerRuntime upsert/read/update and lifecycle/lease path;
- migration-authority guard and secret-redaction guard.

## 10. Explicit unknowns and stop conditions

Repository evidence does not establish the state of any deployed database.
Implementation must stop before mutation if a target cannot be classified,
catalog access is insufficient to verify the contract, the full transfer cannot
run transactionally, any object falls outside this inventory, or a mismatch
would require destructive repair. No Prisma migration resolve, metadata write,
manual bootstrap table, or undocumented repair SQL is authorized.
