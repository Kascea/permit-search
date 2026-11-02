CREATE TABLE "search_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "search_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"search_id" bigint NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"was_reused" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "searches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" varchar(16) NOT NULL,
	"city_id" bigint NOT NULL,
	"permit_query" varchar(240) NOT NULL,
	"normalized_query" varchar(240) NOT NULL,
	"query_key" varchar(500) NOT NULL,
	"pipeline_version" integer NOT NULL,
	"permit_types" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"result_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reuse_until" timestamp with time zone NOT NULL,
	"times_served" integer DEFAULT 1 NOT NULL,
	"last_served_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_requests" ADD CONSTRAINT "search_requests_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "searches" ADD CONSTRAINT "searches_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_requests_search_id" ON "search_requests" USING btree ("search_id");--> statement-breakpoint
CREATE UNIQUE INDEX "searches_public_id" ON "searches" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "searches_query_key_created_at" ON "searches" USING btree ("query_key","created_at");--> statement-breakpoint
CREATE INDEX "searches_city_id" ON "searches" USING btree ("city_id");