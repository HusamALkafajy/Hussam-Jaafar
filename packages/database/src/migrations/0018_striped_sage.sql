ALTER TABLE "flashcard_sets" ADD COLUMN "origin_graph_version" varchar(255);--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "card_type" varchar(100);--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "version" varchar(255);--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "knowledge_node_id" varchar(255);--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "source_references" text;