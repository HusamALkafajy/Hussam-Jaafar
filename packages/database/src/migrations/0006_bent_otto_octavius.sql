CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid,
	"title" varchar(255) DEFAULT 'Untitled Note' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"ai_summary" text,
	"quiz_questions" jsonb,
	"color" varchar(30) DEFAULT 'default' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "category" varchar(50);--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "is_auto_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;