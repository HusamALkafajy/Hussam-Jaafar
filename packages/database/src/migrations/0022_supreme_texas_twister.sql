--> statement-breakpoint
DO $ownership_transfer$
DECLARE
  lock_key bigint := hashtextextended('studyai:prisma-to-drizzle:20260706214228', 0);
  enum_names text[] := ARRAY['WorkflowStatus', 'JobStatus', 'AssetType', 'AssetStatus', 'EventStatus', 'JobExecutionStatus', 'WorkerStatus', 'UploadStatus'];
  table_names text[] := ARRAY['Workflow', 'WorkflowJob', 'WorkflowEvent', 'LearningAsset', 'AssetCapability', 'StudyPlan', 'LearningObjective', 'Assessment', 'Question', 'Submission', 'AssessmentResult', 'RevisionSession', 'RevisionItem', 'RevisionSchedule', 'AnalyticsEvent', 'AnalyticsSnapshot', 'IdentityContext', 'SecurityRole', 'SecurityPermission', 'SecurityPolicy', 'ConnectorInstance', 'ConnectorEvent', 'IntegrationConfig', 'RecommendationContext', 'RecommendationItem', 'PlatformAsset', 'StoredEvent', 'JobExecution', 'WorkerRuntime', 'BinaryObjectMetadata'];
  all_enum_types integer;
  present_enums integer;
  all_table_relations integer;
  present_tables integer;
  sql_command text;
  temp_ddl text;
  object_name text;
  actual_definition text;
  expected_definition text;
  actual_enum text[];
  expected_enum text[];
  migration_commands text[] := ARRAY[
    $ddl$CREATE TYPE "public"."AssetStatus" AS ENUM('UPLOADING', 'PROCESSING', 'READY', 'ERROR');$ddl$,
    $ddl$
CREATE TYPE "public"."AssetType" AS ENUM('DOCUMENT', 'VIDEO', 'WEBPAGE', 'TEXT');$ddl$,
    $ddl$
CREATE TYPE "public"."EventStatus" AS ENUM('PENDING', 'PUBLISHED', 'FAILED');$ddl$,
    $ddl$
CREATE TYPE "public"."JobExecutionStatus" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');$ddl$,
    $ddl$
CREATE TYPE "public"."JobStatus" AS ENUM('QUEUED', 'PROCESSING', 'DONE', 'RETRYING', 'FAILED');$ddl$,
    $ddl$
CREATE TYPE "public"."UploadStatus" AS ENUM('PENDING', 'UPLOADING', 'COMPLETED', 'FAILED');$ddl$,
    $ddl$
CREATE TYPE "public"."WorkerStatus" AS ENUM('STARTING', 'IDLE', 'PROCESSING', 'PAUSED', 'DRAINING', 'STOPPED', 'DEAD');$ddl$,
    $ddl$
CREATE TYPE "public"."WorkflowStatus" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'COMPENSATING');$ddl$,
    $ddl$
CREATE TABLE "AnalyticsSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"metrics" jsonb NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "Assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3)
);$ddl$,
    $ddl$CREATE TABLE "AssessmentResult" (
	"id" text PRIMARY KEY NOT NULL,
	"assessmentId" text NOT NULL,
	"userId" text NOT NULL,
	"score" double precision NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "AssetCapability" (
	"id" text PRIMARY KEY NOT NULL,
	"assetId" text NOT NULL,
	"feature" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "ConnectorEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"instanceId" text NOT NULL,
	"eventType" text NOT NULL,
	"payload" jsonb NOT NULL,
	"timestamp" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "ConnectorInstance" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "IdentityContext" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3)
);$ddl$,
    $ddl$CREATE TABLE "IntegrationConfig" (
	"id" text PRIMARY KEY NOT NULL,
	"instanceId" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "JobExecution" (
	"jobId" text PRIMARY KEY NOT NULL,
	"jobType" text NOT NULL,
	"correlationId" text,
	"causationId" text,
	"traceId" text,
	"workflowId" text,
	"aggregateId" text,
	"status" "JobExecutionStatus" DEFAULT 'PENDING' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payloadHash" text,
	"errorMessage" text,
	"workerName" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"startedAt" timestamp (3),
	"completedAt" timestamp (3),
	"failedAt" timestamp (3),
	"duration" integer
);$ddl$,
    $ddl$CREATE TABLE "LearningAsset" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"type" "AssetType" NOT NULL,
	"sourceUrl" text,
	"content" text,
	"status" "AssetStatus" NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3)
);$ddl$,
    $ddl$CREATE TABLE "LearningObjective" (
	"id" text PRIMARY KEY NOT NULL,
	"planId" text NOT NULL,
	"topic" text NOT NULL,
	"mastery" double precision DEFAULT 0.0 NOT NULL,
	"targetDate" timestamp (3)
);$ddl$,
    $ddl$CREATE TABLE "PlatformAsset" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"bucket" text NOT NULL,
	"size" integer NOT NULL,
	"mimeType" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deletedAt" timestamp (3)
);$ddl$,
    $ddl$CREATE TABLE "AnalyticsEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"userId" text NOT NULL,
	"payload" jsonb NOT NULL,
	"timestamp" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "BinaryObjectMetadata" (
	"objectId" text PRIMARY KEY NOT NULL,
	"storageProvider" text NOT NULL,
	"bucket" text NOT NULL,
	"storageKey" text NOT NULL,
	"checksumSHA256" text,
	"contentLength" bigint NOT NULL,
	"contentType" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"encryptionState" text,
	"compressionState" text,
	"retentionPolicy" text,
	"uploadStatus" "UploadStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3)
);$ddl$,
    $ddl$CREATE TABLE "Question" (
	"id" text PRIMARY KEY NOT NULL,
	"assessmentId" text NOT NULL,
	"text" text NOT NULL,
	"type" text NOT NULL,
	"answer" text
);$ddl$,
    $ddl$CREATE TABLE "StoredEvent" (
	"eventId" text PRIMARY KEY NOT NULL,
	"aggregateId" text NOT NULL,
	"aggregateType" text NOT NULL,
	"eventType" text NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "EventStatus" DEFAULT 'PENDING' NOT NULL,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"occurredAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"publishedAt" timestamp (3)
);$ddl$,
    $ddl$CREATE TABLE "StudyPlan" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "RecommendationContext" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"scope" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "RecommendationItem" (
	"id" text PRIMARY KEY NOT NULL,
	"contextId" text NOT NULL,
	"targetId" text NOT NULL,
	"score" double precision NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "RevisionItem" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"targetId" text NOT NULL,
	"recall" double precision NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "RevisionSchedule" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"nextDate" timestamp (3) NOT NULL,
	"interval" integer NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "RevisionSession" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"startedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"endedAt" timestamp (3),
	"version" integer DEFAULT 1 NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "SecurityPermission" (
	"id" text PRIMARY KEY NOT NULL,
	"identityId" text NOT NULL,
	"action" text NOT NULL,
	"resource" text NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "SecurityPolicy" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"rules" jsonb NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "SecurityRole" (
	"id" text PRIMARY KEY NOT NULL,
	"identityId" text NOT NULL,
	"roleName" text NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "Submission" (
	"id" text PRIMARY KEY NOT NULL,
	"assessmentId" text NOT NULL,
	"userId" text NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "WorkerRuntime" (
	"workerId" text PRIMARY KEY NOT NULL,
	"workerName" text NOT NULL,
	"status" "WorkerStatus" DEFAULT 'IDLE' NOT NULL,
	"capabilities" jsonb,
	"startedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastHeartbeat" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"leaseExpiration" timestamp (3) NOT NULL,
	"currentJobId" text,
	"processedJobs" integer DEFAULT 0 NOT NULL,
	"failedJobs" integer DEFAULT 0 NOT NULL,
	"averageDuration" double precision DEFAULT 0.0 NOT NULL,
	"version" text NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "Workflow" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" "WorkflowStatus" NOT NULL,
	"payload" jsonb,
	"error" text,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "WorkflowEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"workflowId" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"data" jsonb NOT NULL
);$ddl$,
    $ddl$CREATE TABLE "WorkflowJob" (
	"id" text PRIMARY KEY NOT NULL,
	"workflowId" text NOT NULL,
	"name" text NOT NULL,
	"status" "JobStatus" NOT NULL,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"startedAt" timestamp (3),
	"completedAt" timestamp (3)
);$ddl$,
    $ddl$ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."Assessment"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "AssetCapability" ADD CONSTRAINT "AssetCapability_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."LearningAsset"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "ConnectorEvent" ADD CONSTRAINT "ConnectorEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."ConnectorInstance"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "public"."ConnectorInstance"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "LearningObjective" ADD CONSTRAINT "LearningObjective_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."StudyPlan"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "Question" ADD CONSTRAINT "Question_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."Assessment"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "RecommendationItem" ADD CONSTRAINT "RecommendationItem_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "public"."RecommendationContext"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "RevisionItem" ADD CONSTRAINT "RevisionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."RevisionSession"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "RevisionSchedule" ADD CONSTRAINT "RevisionSchedule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."RevisionSession"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "SecurityPermission" ADD CONSTRAINT "SecurityPermission_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "public"."IdentityContext"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "SecurityRole" ADD CONSTRAINT "SecurityRole_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "public"."IdentityContext"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."Assessment"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
ALTER TABLE "WorkflowJob" ADD CONSTRAINT "WorkflowJob_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE cascade ON UPDATE cascade;$ddl$,
    $ddl$
CREATE UNIQUE INDEX "IdentityContext_userId_key" ON "IdentityContext" USING btree ("userId");$ddl$,
    $ddl$
CREATE INDEX "JobExecution_status_createdAt_idx" ON "JobExecution" USING btree ("status","createdAt");$ddl$,
    $ddl$
CREATE INDEX "JobExecution_correlationId_idx" ON "JobExecution" USING btree ("correlationId");$ddl$,
    $ddl$
CREATE INDEX "JobExecution_jobType_idx" ON "JobExecution" USING btree ("jobType");$ddl$,
    $ddl$
CREATE INDEX "LearningAsset_userId_type_idx" ON "LearningAsset" USING btree ("userId","type");$ddl$,
    $ddl$
CREATE UNIQUE INDEX "PlatformAsset_key_key" ON "PlatformAsset" USING btree ("key");$ddl$,
    $ddl$
CREATE INDEX "BinaryObjectMetadata_uploadStatus_idx" ON "BinaryObjectMetadata" USING btree ("uploadStatus");$ddl$,
    $ddl$
CREATE INDEX "BinaryObjectMetadata_checksumSHA256_idx" ON "BinaryObjectMetadata" USING btree ("checksumSHA256");$ddl$,
    $ddl$
CREATE UNIQUE INDEX "BinaryObjectMetadata_bucket_storageKey_key" ON "BinaryObjectMetadata" USING btree ("bucket","storageKey");$ddl$,
    $ddl$
CREATE INDEX "StoredEvent_aggregateId_idx" ON "StoredEvent" USING btree ("aggregateId");$ddl$,
    $ddl$
CREATE INDEX "StoredEvent_status_occurredAt_idx" ON "StoredEvent" USING btree ("status","occurredAt");$ddl$,
    $ddl$
CREATE INDEX "WorkerRuntime_status_idx" ON "WorkerRuntime" USING btree ("status");$ddl$,
    $ddl$
CREATE INDEX "WorkerRuntime_leaseExpiration_idx" ON "WorkerRuntime" USING btree ("leaseExpiration");$ddl$,
    $ddl$
CREATE INDEX "Workflow_status_idx" ON "Workflow" USING btree ("status");$ddl$
  ];
BEGIN
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT count(*) INTO all_enum_types
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = ANY(enum_names);

  SELECT count(*) INTO present_enums
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname = ANY(enum_names);

  SELECT count(*) INTO all_table_relations
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = ANY(table_names);

  SELECT count(*) INTO present_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname = ANY(table_names);

  IF all_enum_types <> present_enums OR all_table_relations <> present_tables THEN
    RAISE EXCEPTION 'Drizzle ownership transfer rejected: a retained Prisma object name has an incompatible PostgreSQL type';
  END IF;

  IF (present_enums, present_tables) NOT IN ((0, 0), (cardinality(enum_names), cardinality(table_names))) THEN
    RAISE EXCEPTION 'Drizzle ownership transfer rejected: retained Prisma schema is partial (enums %, tables %)', present_enums, present_tables;
  END IF;

  IF present_enums = 0 THEN
    PERFORM set_config('search_path', 'public', true);
    FOREACH sql_command IN ARRAY migration_commands LOOP
      EXECUTE sql_command;
    END LOOP;
    RETURN;
  END IF;

  PERFORM set_config('search_path', 'pg_temp, public', true);

  FOREACH sql_command IN ARRAY migration_commands LOOP
    IF sql_command LIKE 'CREATE TYPE %' THEN
      temp_ddl := replace(sql_command, 'CREATE TYPE "public".', 'CREATE TYPE pg_temp.');
    ELSIF sql_command LIKE 'CREATE TABLE %' THEN
      temp_ddl := replace(sql_command, 'CREATE TABLE ', 'CREATE TEMP TABLE ');
      temp_ddl := replace(temp_ddl, '"public".', 'pg_temp.');
      temp_ddl := left(temp_ddl, length(temp_ddl) - 1) || ' ON COMMIT DROP;';
    ELSE
      temp_ddl := replace(sql_command, '"public".', '');
    END IF;
    EXECUTE temp_ddl;
  END LOOP;

  FOREACH object_name IN ARRAY enum_names LOOP
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO actual_enum
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = object_name;

    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO expected_enum
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typnamespace = pg_my_temp_schema() AND t.typname = object_name;

    IF actual_enum IS DISTINCT FROM expected_enum THEN
      RAISE EXCEPTION 'Drizzle ownership transfer rejected: enum % does not match the retained Prisma contract', object_name;
    END IF;
  END LOOP;

  FOREACH object_name IN ARRAY table_names LOOP
    SELECT string_agg(
      format('%s|%s|%s|%s|%s', a.attnum, a.attname,
        CASE WHEN t.typtype = 'e' THEN t.typname ELSE pg_catalog.format_type(a.atttypid, a.atttypmod) END,
        a.attnotnull,
        regexp_replace(coalesce(pg_get_expr(d.adbin, d.adrelid), ''), '"?(pg_temp_[0-9]+|public)"?[.]', '', 'g')
      ), E'\\n' ORDER BY a.attnum
    ) INTO actual_definition
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relname = object_name AND a.attnum > 0 AND NOT a.attisdropped;

    SELECT string_agg(
      format('%s|%s|%s|%s|%s', a.attnum, a.attname,
        CASE WHEN t.typtype = 'e' THEN t.typname ELSE pg_catalog.format_type(a.atttypid, a.atttypmod) END,
        a.attnotnull,
        regexp_replace(coalesce(pg_get_expr(d.adbin, d.adrelid), ''), '"?(pg_temp_[0-9]+|public)"?[.]', '', 'g')
      ), E'\\n' ORDER BY a.attnum
    ) INTO expected_definition
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_type t ON t.oid = a.atttypid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relnamespace = pg_my_temp_schema() AND c.relname = object_name AND a.attnum > 0 AND NOT a.attisdropped;

    IF actual_definition IS DISTINCT FROM expected_definition THEN
      RAISE EXCEPTION 'Drizzle ownership transfer rejected: table columns for % do not match the retained Prisma contract', object_name;
    END IF;

    SELECT string_agg(
      con.conname || '|' || con.contype::text || '|' || regexp_replace(pg_get_constraintdef(con.oid, true), '"?(pg_temp_[0-9]+|public)"?[.]', '', 'g'),
      E'\\n' ORDER BY con.conname, con.contype
    ) INTO actual_definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = object_name;

    SELECT string_agg(
      con.conname || '|' || con.contype::text || '|' || regexp_replace(pg_get_constraintdef(con.oid, true), '"?(pg_temp_[0-9]+|public)"?[.]', '', 'g'),
      E'\\n' ORDER BY con.conname, con.contype
    ) INTO expected_definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    WHERE c.relnamespace = pg_my_temp_schema() AND c.relname = object_name;

    IF actual_definition IS DISTINCT FROM expected_definition THEN
      RAISE EXCEPTION 'Drizzle ownership transfer rejected: constraints for % do not match the retained Prisma contract', object_name;
    END IF;

    SELECT string_agg(
      regexp_replace(pg_get_indexdef(i.indexrelid), '"?(pg_temp(_[0-9]+)?|public)"?[.]', '', 'g'),
      E'\\n' ORDER BY i.indexrelid::regclass::text
    ) INTO actual_definition
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = object_name;

    SELECT string_agg(
      regexp_replace(pg_get_indexdef(i.indexrelid), '"?(pg_temp(_[0-9]+)?|public)"?[.]', '', 'g'),
      E'\\n' ORDER BY i.indexrelid::regclass::text
    ) INTO expected_definition
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    WHERE c.relnamespace = pg_my_temp_schema() AND c.relname = object_name;

    IF actual_definition IS DISTINCT FROM expected_definition THEN
      RAISE EXCEPTION 'Drizzle ownership transfer rejected: indexes for % do not match the retained Prisma contract', object_name;
    END IF;
  END LOOP;
END;
$ownership_transfer$;
