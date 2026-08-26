CREATE TYPE "public"."file_processing_status" AS ENUM('enqueue_pending', 'dispatching', 'queued', 'processing', 'completed', 'failed', 'enqueue_failed');--> statement-breakpoint
CREATE TABLE "file_processing_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"queue_job_id" varchar(255) NOT NULL,
	"status" "file_processing_status" DEFAULT 'enqueue_pending' NOT NULL,
	"dispatch_lease_started_at" timestamp with time zone,
	"dispatch_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "file_processing_attempts_queue_job_id_unique" UNIQUE("queue_job_id")
);
--> statement-breakpoint
ALTER TABLE "file_processing_attempts" ADD CONSTRAINT "file_processing_attempts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_processing_attempts_file_id_idx" ON "file_processing_attempts" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_processing_active_attempt_idx" ON "file_processing_attempts" USING btree ("file_id") WHERE "file_processing_attempts"."status" IN ('enqueue_pending', 'dispatching', 'queued', 'processing');--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_file_processing_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';
--> statement-breakpoint
CREATE TRIGGER update_file_processing_attempts_updated_at_trigger
BEFORE UPDATE ON "file_processing_attempts"
FOR EACH ROW EXECUTE PROCEDURE update_file_processing_attempts_updated_at();
