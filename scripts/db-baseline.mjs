// One-time: records migrations already applied by the old Worker-based runner
// (listed in app_migrations) in Drizzle's own table, so `drizzle-kit migrate`
// doesn't run them again. Safe to rerun; it skips migrations already recorded.
// Usage: node scripts/db-baseline.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import pg from 'pg'

process.loadEnvFile()
const client = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
})
await client.connect()

try {
  await client.query('BEGIN')
  const { rows } = await client.query('SELECT tag FROM app_migrations')
  const applied = new Set(rows.map(({ tag }) => tag))

  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
  await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`)
  const recorded = await client.query(
    'SELECT hash FROM drizzle.__drizzle_migrations',
  )
  const recordedHashes = new Set(recorded.rows.map(({ hash }) => hash))

  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'))
  const result = { recorded: [], alreadyRecorded: [], notApplied: [] }
  for (const { tag, when } of journal.entries) {
    if (!applied.has(tag)) {
      result.notApplied.push(tag)
      continue
    }
    // Drizzle identifies a migration by the SHA-256 of its SQL file.
    const hash = createHash('sha256')
      .update(readFileSync(`drizzle/${tag}.sql`, 'utf8'))
      .digest('hex')
    if (recordedHashes.has(hash)) {
      result.alreadyRecorded.push(tag)
      continue
    }
    await client.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [hash, when],
    )
    result.recorded.push(tag)
  }

  await client.query('COMMIT')
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
