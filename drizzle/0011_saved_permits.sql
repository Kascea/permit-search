CREATE TABLE "blank_pdfs" (
	"source_hash" char(64) PRIMARY KEY NOT NULL,
	"byte_size" integer NOT NULL,
	"page_count" integer NOT NULL,
	"field_count" integer NOT NULL,
	"pdf_modified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_permits" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saved_permits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" varchar(16) NOT NULL,
	"user_id" text NOT NULL,
	"source_url" varchar(2048) NOT NULL,
	"source_hash" char(64) NOT NULL,
	"title" varchar(300) NOT NULL,
	"city_name" varchar(100) NOT NULL,
	"city_region" varchar(100) NOT NULL,
	"permit_types" jsonb NOT NULL,
	"search_id" bigint,
	"notes" varchar(2000) DEFAULT '' NOT NULL,
	"version_saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_permits" ADD CONSTRAINT "saved_permits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_permits" ADD CONSTRAINT "saved_permits_source_hash_blank_pdfs_source_hash_fk" FOREIGN KEY ("source_hash") REFERENCES "public"."blank_pdfs"("source_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_permits" ADD CONSTRAINT "saved_permits_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_permits_public_id" ON "saved_permits" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_permits_user_source" ON "saved_permits" USING btree ("user_id","source_url");--> statement-breakpoint
CREATE INDEX "saved_permits_user_city_title" ON "saved_permits" USING btree ("user_id","city_region","city_name","title");