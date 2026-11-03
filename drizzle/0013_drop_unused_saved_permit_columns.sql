-- An earlier draft of 0011 added these link-check columns. They were taken out
-- of the schema before release; IF EXISTS skips databases that never had them.
-- Dropping last_checked_at also drops its index.
ALTER TABLE "saved_permits" DROP COLUMN IF EXISTS "last_checked_at";--> statement-breakpoint
ALTER TABLE "saved_permits" DROP COLUMN IF EXISTS "link_broken_since";
