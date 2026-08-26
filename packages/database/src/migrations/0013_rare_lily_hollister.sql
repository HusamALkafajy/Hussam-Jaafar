CREATE TYPE "public"."node_type" AS ENUM('document', 'section', 'column', 'heading', 'paragraph', 'quote', 'code', 'list', 'list_item', 'table', 'table_row', 'table_cell', 'image', 'equation', 'video', 'audio', 'footnote', 'citation', 'callout', 'reference_list');--> statement-breakpoint
ALTER TABLE "annotations" DROP CONSTRAINT "check_ann_offsets";--> statement-breakpoint
ALTER TABLE "document_nodes" ALTER COLUMN "node_type" SET DATA TYPE node_type USING "node_type"::"node_type";--> statement-breakpoint
ALTER TABLE "document_nodes" ADD CONSTRAINT "idx_doc_nodes_id_version" UNIQUE("id","version_id");--> statement-breakpoint
ALTER TABLE "document_nodes" ADD CONSTRAINT "fk_parent_version" FOREIGN KEY ("parent_id","version_id") REFERENCES "public"."document_nodes"("id","version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_doc_nodes_root_rank" ON "document_nodes" USING btree ("file_id","version_id","lexo_rank") WHERE "document_nodes"."parent_id" IS NULL;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "check_ann_offsets_positive" CHECK ("annotations"."start_offset" >= 0 AND "annotations"."start_offset" < "annotations"."end_offset");--> statement-breakpoint
ALTER TABLE "document_nodes" ADD CONSTRAINT "check_not_self_parent" CHECK ("document_nodes"."id" != "document_nodes"."parent_id");