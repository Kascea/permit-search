DROP INDEX "pdf_drafts_user_source";--> statement-breakpoint
ALTER TABLE "pdf_drafts" ADD COLUMN "project_item_id" bigint;--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "filed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pdf_drafts" ADD CONSTRAINT "pdf_drafts_project_item_id_project_items_id_fk" FOREIGN KEY ("project_item_id") REFERENCES "public"."project_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- A draft joins the project form with its URL only when exactly one of the
-- user's projects holds that form. With several, nothing says which job its
-- answers are for, so it stays in Drafts and each project's copy starts blank.
UPDATE "pdf_drafts" AS draft
SET "project_item_id" = only_form.id
FROM (
  SELECT project.user_id, item.source_url, min(item.id) AS id
  FROM "project_items" AS item
  JOIN "projects" AS project ON project.id = item.project_id
  WHERE item.kind = 'pdf'
  GROUP BY project.user_id, item.source_url
  HAVING count(*) = 1
) AS only_form
WHERE draft.user_id = only_form.user_id
  AND draft.source_url = only_form.source_url;--> statement-breakpoint
-- A permit number means the form was filed.
UPDATE "project_items" AS item
SET "filed_at" = tracked.created_at
FROM "tracked_permits" AS tracked
WHERE tracked.project_item_id = item.id;--> statement-breakpoint
CREATE UNIQUE INDEX "pdf_drafts_user_source_loose" ON "pdf_drafts" USING btree ("user_id","source_url") WHERE "pdf_drafts"."project_item_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "pdf_drafts_project_item" ON "pdf_drafts" USING btree ("project_item_id");
