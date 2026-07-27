-- Base identity enums are created by migration 0000.
CREATE TYPE "public"."kg_edge_type" AS ENUM('DEFINES', 'EXEMPLIFIES', 'DEPENDS_ON', 'PREREQUISITE_OF', 'EXPLAINS', 'CONTRADICTS', 'BELONGS_TO');--> statement-breakpoint
CREATE TYPE "public"."kg_node_type" AS ENUM('Concept', 'Definition', 'Rule', 'Algorithm', 'Formula', 'Example', 'Term');--> statement-breakpoint
CREATE TABLE "knowledge_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"edge_type" "kg_edge_type" NOT NULL,
	"confidence_score" real DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_ke_not_self" CHECK ("knowledge_edges"."source_node_id" != "knowledge_edges"."target_node_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"deterministic_hash" varchar(255) NOT NULL,
	"node_type" "kg_node_type" NOT NULL,
	"label" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"source_chunk_id" varchar(255),
	"confidence_score" real DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "origin_graph_version" varchar(255);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "version" varchar(255);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "knowledge_node_id" varchar(255);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_references" text;--> statement-breakpoint
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_source_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_target_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ke_source_target_type" ON "knowledge_edges" USING btree ("source_node_id","target_node_id","edge_type");--> statement-breakpoint
CREATE INDEX "idx_ke_source" ON "knowledge_edges" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "idx_ke_target" ON "knowledge_edges" USING btree ("target_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kn_version_hash" ON "knowledge_nodes" USING btree ("version_id","deterministic_hash");--> statement-breakpoint
CREATE INDEX "idx_kn_file" ON "knowledge_nodes" USING btree ("file_id");
