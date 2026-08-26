ALTER TABLE "knowledge_nodes" DROP CONSTRAINT "knowledge_nodes_version_id_document_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ALTER COLUMN "version_id" DROP NOT NULL;