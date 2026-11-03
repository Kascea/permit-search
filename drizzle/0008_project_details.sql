ALTER TABLE "projects" ADD COLUMN "street_address" varchar(200);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "unit" varchar(40);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "zip_code" varchar(10);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "parcel_number" varchar(60);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "work_description" varchar(2000);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "estimated_cost" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_name" varchar(120);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_email" varchar(254);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_mailing_address" varchar(300);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "applicant_is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "applicant_name" varchar(120);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "applicant_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "applicant_email" varchar(254);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contractor_company" varchar(200);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contractor_license" varchar(60);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contractor_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "contractor_email" varchar(254);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "extra_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;