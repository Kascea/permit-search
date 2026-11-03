CREATE TABLE "form_schemas" (
	"source_hash" char(64) PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"schema" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
