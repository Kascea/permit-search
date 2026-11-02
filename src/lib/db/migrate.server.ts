import { withDatabaseClient } from '#/lib/db/client.server'

import journal from '../../../drizzle/meta/_journal.json'

// drizzle-kit's migration files, bundled into the Worker because it has no
// filesystem to read them from at runtime.
const migrationFiles = import.meta.glob<string>('../../../drizzle/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface MigrationResult {
  applied: Array<string>
  alreadyApplied: Array<string>
}

// Applies drizzle-kit migrations in journal order, each in its own
// transaction, and records them in app_migrations so reruns skip them.
export async function runMigrations(): Promise<MigrationResult> {
  return withDatabaseClient(async (client) => {
    await client.query(
      `CREATE TABLE IF NOT EXISTS app_migrations (
        tag varchar(255) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    )
    // Hyperdrive caches reads outside transactions, which could return a
    // stale list and re-run a migration; reads inside one go to the database.
    await client.query('BEGIN')
    const { rows } = await client.query<{ tag: string }>(
      'SELECT tag FROM app_migrations',
    )
    await client.query('COMMIT')
    const appliedTags = new Set(rows.map(({ tag }) => tag))
    const result: MigrationResult = { applied: [], alreadyApplied: [] }

    for (const { tag } of journal.entries) {
      if (appliedTags.has(tag)) {
        result.alreadyApplied.push(tag)
        continue
      }

      const sql = migrationFiles[`../../../drizzle/${tag}.sql`]
      if (typeof sql !== 'string') {
        throw new Error(`Migration file for ${tag} is missing.`)
      }

      await client.query('BEGIN')
      try {
        for (const statement of sql.split('--> statement-breakpoint')) {
          if (statement.trim()) {
            await client.query(statement)
          }
        }
        await client.query('INSERT INTO app_migrations (tag) VALUES ($1)', [
          tag,
        ])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(
          `Migration ${tag} failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      result.applied.push(tag)
    }

    return result
  })
}
