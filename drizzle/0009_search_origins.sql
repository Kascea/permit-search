ALTER TABLE "pdf_drafts" ADD COLUMN "search_id" bigint;--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "search_id" bigint;--> statement-breakpoint
ALTER TABLE "pdf_drafts" ADD CONSTRAINT "pdf_drafts_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;