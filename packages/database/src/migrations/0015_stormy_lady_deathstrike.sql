ALTER TABLE "exams" ADD COLUMN "evaluation_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "evaluation_locked_at" timestamp with time zone;