import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile()
} catch {
  // No .env file: rely on the shell's environment.
}

// `npm run db:generate` needs no database. `npm run db:migrate` connects
// directly as the `migrator` role, which owns the schema; the Worker and local
// dev use other roles that can read and write but not change tables.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? '',
  },
})
