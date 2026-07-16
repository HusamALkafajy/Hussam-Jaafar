CREATE TYPE "public"."event_status" AS ENUM('PENDING', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "binary_object_metadata" (
	"object_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_provider" varchar(255) NOT NULL,
	"bucket" varchar(255) NOT NULL,
	"storage_key" varchar(1024) NOT NULL,
	"checksum_sha256" varchar(255),
	"content_length" bigint NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"encryption_state" varchar(255),
	"compression_state" varchar(255),
	"retention_policy" varchar(255),
	"upload_status" "upload_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stored_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_id" varchar(255) NOT NULL,
	"aggregate_type" varchar(255) NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "event_status" DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bucket_key_idx" ON "binary_object_metadata" USING btree ("bucket","storage_key");--> statement-breakpoint
CREATE INDEX "upload_status_idx" ON "binary_object_metadata" USING btree ("upload_status");--> statement-breakpoint
CREATE INDEX "checksum_idx" ON "binary_object_metadata" USING btree ("checksum_sha256");--> statement-breakpoint
CREATE INDEX "aggregate_id_idx" ON "stored_events" USING btree ("aggregate_id");--> statement-breakpoint
CREATE INDEX "status_occurred_at_idx" ON "stored_events" USING btree ("status","occurred_at");