ALTER TYPE "public"."file_processing_status" ADD VALUE 'retrying';--> statement-breakpoint
COMMIT;--> statement-breakpoint
BEGIN;--> statement-breakpoint
DROP INDEX "file_processing_active_attempt_idx";--> statement-breakpoint
ALTER TABLE "file_processing_attempts" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "file_processing_attempts" ADD COLUMN "error_code" varchar(255);--> statement-breakpoint
ALTER TABLE "file_processing_attempts" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "file_processing_attempts" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "file_processing_active_attempt_idx" ON "file_processing_attempts" USING btree ("file_id") WHERE "file_processing_attempts"."status" IN ('enqueue_pending', 'dispatching', 'queued', 'processing', 'retrying');