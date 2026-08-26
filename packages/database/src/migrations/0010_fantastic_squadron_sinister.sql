CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"exact_text" text NOT NULL,
	"color" varchar(50),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_ann_offsets" CHECK ("annotations"."start_offset" < "annotations"."end_offset")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"title" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"node_id" uuid,
	"asset_type" varchar(50) NOT NULL,
	"storage_url" text NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"parent_id" uuid,
	"node_type" varchar(50) NOT NULL,
	"lexo_rank" varchar(255) NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_lexo_rank_not_empty" CHECK (length("document_nodes"."lexo_rank") > 0)
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"commit_message" text
);
--> statement-breakpoint
CREATE TABLE "node_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_rel_not_self" CHECK ("node_relationships"."source_node_id" != "node_relationships"."target_node_id")
);
--> statement-breakpoint
CREATE TABLE "processing_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"extracted_ast" jsonb,
	"error_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"total_chunks" integer DEFAULT 0 NOT NULL,
	"completed_chunks" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_node_id_document_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."document_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_node_id_document_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."document_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_node_id_document_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."document_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_nodes" ADD CONSTRAINT "document_nodes_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_nodes" ADD CONSTRAINT "document_nodes_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_relationships" ADD CONSTRAINT "node_relationships_source_node_id_document_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."document_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_relationships" ADD CONSTRAINT "node_relationships_target_node_id_document_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."document_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_checkpoints" ADD CONSTRAINT "processing_checkpoints_session_id_processing_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."processing_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_sessions" ADD CONSTRAINT "processing_sessions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ann_user_file" ON "annotations" USING btree ("user_id","file_id");--> statement-breakpoint
CREATE INDEX "idx_ann_node" ON "annotations" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "idx_bmk_user_file" ON "bookmarks" USING btree ("user_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bmk_unique_user_node" ON "bookmarks" USING btree ("user_id","node_id");--> statement-breakpoint
CREATE INDEX "idx_doc_nodes_parent_rank" ON "document_nodes" USING btree ("file_id","version_id","parent_id","lexo_rank");--> statement-breakpoint
CREATE INDEX "idx_doc_nodes_type" ON "document_nodes" USING btree ("node_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_doc_nodes_unique_sibling_rank" ON "document_nodes" USING btree ("parent_id","lexo_rank");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_doc_versions_file_version" ON "document_versions" USING btree ("file_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_node_rel_source" ON "node_relationships" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "idx_node_rel_target" ON "node_relationships" USING btree ("target_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_node_rel_unique" ON "node_relationships" USING btree ("source_node_id","target_node_id","relationship_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chkpt_session_chunk" ON "processing_checkpoints" USING btree ("session_id","chunk_index");