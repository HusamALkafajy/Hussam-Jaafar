ALTER TABLE "exams" ADD COLUMN "adaptive_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "ai_feedback" text;