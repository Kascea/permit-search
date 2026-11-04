CREATE TYPE "public"."project_item_kind" AS ENUM('pdf', 'online');--> statement-breakpoint
CREATE TABLE "portal_catalogs" (
	"provider" varchar(40) NOT NULL,
	"jurisdiction" varchar(80) NOT NULL,
	"fetched_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"type_count" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_catalogs_provider_jurisdiction_pk" PRIMARY KEY("provider","jurisdiction")
);
--> statement-breakpoint
CREATE TABLE "portal_permit_types" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "portal_permit_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" varchar(40) NOT NULL,
	"jurisdiction" varchar(80) NOT NULL,
	"external_id" varchar(200) NOT NULL,
	"name" varchar(300) NOT NULL,
	"category" varchar(300),
	"plans_required" boolean,
	"page_url" varchar(2048) NOT NULL,
	"apply_url" varchar(2048),
	"fee_estimator_url" varchar(2048),
	"requirements" jsonb,
	"requirements_fetched_at" timestamp with time zone,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "kind" "project_item_kind" DEFAULT 'pdf' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "portal_permit_type_id" bigint;--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "parent_item_id" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_permit_types_external" ON "portal_permit_types" USING btree ("provider","jurisdiction","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_permit_types_page_url" ON "portal_permit_types" USING btree ("page_url");--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_portal_permit_type_id_portal_permit_types_id_fk" FOREIGN KEY ("portal_permit_type_id") REFERENCES "public"."portal_permit_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_parent_item_id_project_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."project_items"("id") ON DELETE cascade ON UPDATE no action;