CREATE TABLE "tracked_permits" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tracked_permits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"project_item_id" bigint NOT NULL,
	"provider" varchar(40) NOT NULL,
	"jurisdiction" varchar(40) NOT NULL,
	"permit_number" varchar(40) NOT NULL,
	"status" jsonb,
	"checked_at" timestamp with time zone,
	"status_changed_at" timestamp with time zone,
	"check_error" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_permits" ADD CONSTRAINT "tracked_permits_project_item_id_project_items_id_fk" FOREIGN KEY ("project_item_id") REFERENCES "public"."project_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_permits_project_item" ON "tracked_permits" USING btree ("project_item_id");