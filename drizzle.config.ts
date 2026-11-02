import { defineConfig } from 'drizzle-kit'

// Generating migrations needs no database. They're applied through the
// Worker's Hyperdrive binding with `npm run db:migrate`; see
// src/routes/api.db.migrate.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
})
