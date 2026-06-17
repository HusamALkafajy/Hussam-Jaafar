ALTER TABLE "flashcards" ADD COLUMN "ease_factor" integer DEFAULT 250 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "interval" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "repetitions" integer DEFAULT 0 NOT NULL;