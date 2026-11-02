-- Migrations now run as the `migrator` role, which owns the schema. Tables and
-- sequences it creates get the same access 0002 granted for the old owner:
-- admin roles used for local development (members of `postgres`) can read and
-- write them. The Worker's Hyperdrive role reads and writes through
-- pg_read_all_data and pg_write_all_data.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
