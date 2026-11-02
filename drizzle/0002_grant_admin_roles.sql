-- Tables are owned by the Hyperdrive role that runs migrations. Admin roles
-- used for local development (PlanetScale roles that inherit `postgres`) get
-- full access to existing and future tables and sequences, so they can read
-- and write data. Schema changes still go through `npm run db:migrate`.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;--> statement-breakpoint
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
