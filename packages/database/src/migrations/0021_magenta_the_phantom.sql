CREATE TYPE "public"."recommendation_event_action" AS ENUM('displayed', 'clicked', 'accepted', 'dismissed', 'completed', 'ignored', 'expired');--> statement-breakpoint
CREATE TABLE "recommendation_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recommendation_id" uuid,
	"rule_identifier" varchar(255) NOT NULL,
	"recommendation_type" varchar(100) NOT NULL,
	"action" "recommendation_event_action" NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendation_analytics" ADD CONSTRAINT "recommendation_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;