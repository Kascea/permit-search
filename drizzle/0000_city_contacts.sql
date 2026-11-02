CREATE TYPE "public"."contacts_status" AS ENUM('found', 'partial', 'not_found');--> statement-breakpoint
CREATE TYPE "public"."office_type" AS ENUM('building', 'zoning', 'engineering', 'general');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"city_key" varchar(220) NOT NULL,
	"name" varchar(100) NOT NULL,
	"region" varchar(100) NOT NULL,
	"census_geoid" char(7),
	"permits_url" varchar(2048),
	"portal_url" varchar(2048),
	"contacts_status" "contacts_status",
	"contacts_checked_at" timestamp with time zone,
	"expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_offices" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "city_offices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"city_id" bigint NOT NULL,
	"office_type" "office_type" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"name" varchar(200),
	"phone" varchar(40),
	"email" varchar(254),
	"street_address" varchar(300),
	"hours" varchar(300),
	"source_url" varchar(2048),
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "city_offices" ADD CONSTRAINT "city_offices_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cities_city_key" ON "cities" USING btree ("city_key");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_census_geoid" ON "cities" USING btree ("census_geoid");--> statement-breakpoint
CREATE INDEX "cities_expires_on" ON "cities" USING btree ("expires_on");--> statement-breakpoint
CREATE UNIQUE INDEX "city_offices_city_type" ON "city_offices" USING btree ("city_id","office_type");--> statement-breakpoint
CREATE INDEX "city_offices_city_id" ON "city_offices" USING btree ("city_id");