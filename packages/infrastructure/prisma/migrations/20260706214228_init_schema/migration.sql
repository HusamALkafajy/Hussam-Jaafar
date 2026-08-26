-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'COMPENSATING');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'RETRYING', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('DOCUMENT', 'VIDEO', 'WEBPAGE', 'TEXT');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('STARTING', 'IDLE', 'PROCESSING', 'PAUSED', 'DRAINING', 'STOPPED', 'DEAD');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL,
    "payload" JSONB,
    "error" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowJob" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "sourceUrl" TEXT,
    "content" TEXT,
    "status" "AssetStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LearningAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCapability" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AssetCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningObjective" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "targetDate" TIMESTAMP(3),

    CONSTRAINT "LearningObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "answer" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RevisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RevisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionSchedule" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nextDate" TIMESTAMP(3) NOT NULL,
    "interval" INTEGER NOT NULL,

    CONSTRAINT "RevisionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityRole" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,

    CONSTRAINT "SecurityRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPermission" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,

    CONSTRAINT "SecurityPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" JSONB NOT NULL,

    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorInstance" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorEvent" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RecommendationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredEvent" (
    "eventId" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "StoredEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "JobExecution" (
    "jobId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "traceId" TEXT,
    "workflowId" TEXT,
    "aggregateId" TEXT,
    "status" "JobExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payloadHash" TEXT,
    "errorMessage" TEXT,
    "workerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "JobExecution_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "WorkerRuntime" (
    "workerId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'IDLE',
    "capabilities" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseExpiration" TIMESTAMP(3) NOT NULL,
    "currentJobId" TEXT,
    "processedJobs" INTEGER NOT NULL DEFAULT 0,
    "failedJobs" INTEGER NOT NULL DEFAULT 0,
    "averageDuration" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "version" TEXT NOT NULL,

    CONSTRAINT "WorkerRuntime_pkey" PRIMARY KEY ("workerId")
);

-- CreateTable
CREATE TABLE "BinaryObjectMetadata" (
    "objectId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksumSHA256" TEXT,
    "contentLength" BIGINT NOT NULL,
    "contentType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "encryptionState" TEXT,
    "compressionState" TEXT,
    "retentionPolicy" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BinaryObjectMetadata_pkey" PRIMARY KEY ("objectId")
);

-- CreateIndex
CREATE INDEX "Workflow_status_idx" ON "Workflow"("status");

-- CreateIndex
CREATE INDEX "LearningAsset_userId_type_idx" ON "LearningAsset"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityContext_userId_key" ON "IdentityContext"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAsset_key_key" ON "PlatformAsset"("key");

-- CreateIndex
CREATE INDEX "StoredEvent_aggregateId_idx" ON "StoredEvent"("aggregateId");

-- CreateIndex
CREATE INDEX "StoredEvent_status_occurredAt_idx" ON "StoredEvent"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "JobExecution_status_createdAt_idx" ON "JobExecution"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobExecution_correlationId_idx" ON "JobExecution"("correlationId");

-- CreateIndex
CREATE INDEX "JobExecution_jobType_idx" ON "JobExecution"("jobType");

-- CreateIndex
CREATE INDEX "WorkerRuntime_status_idx" ON "WorkerRuntime"("status");

-- CreateIndex
CREATE INDEX "WorkerRuntime_leaseExpiration_idx" ON "WorkerRuntime"("leaseExpiration");

-- CreateIndex
CREATE INDEX "BinaryObjectMetadata_uploadStatus_idx" ON "BinaryObjectMetadata"("uploadStatus");

-- CreateIndex
CREATE INDEX "BinaryObjectMetadata_checksumSHA256_idx" ON "BinaryObjectMetadata"("checksumSHA256");

-- CreateIndex
CREATE UNIQUE INDEX "BinaryObjectMetadata_bucket_storageKey_key" ON "BinaryObjectMetadata"("bucket", "storageKey");

-- AddForeignKey
ALTER TABLE "WorkflowJob" ADD CONSTRAINT "WorkflowJob_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCapability" ADD CONSTRAINT "AssetCapability_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "LearningAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningObjective" ADD CONSTRAINT "LearningObjective_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionItem" ADD CONSTRAINT "RevisionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RevisionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSchedule" ADD CONSTRAINT "RevisionSchedule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RevisionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityRole" ADD CONSTRAINT "SecurityRole_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "IdentityContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityPermission" ADD CONSTRAINT "SecurityPermission_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "IdentityContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorEvent" ADD CONSTRAINT "ConnectorEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ConnectorInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ConnectorInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "RecommendationContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
