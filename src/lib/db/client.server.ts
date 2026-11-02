import { env, waitUntil } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'

import * as schema from '#/lib/db/schema'

export type Database = NodePgDatabase<typeof schema>

function databaseBinding() {
  return (env as { DATABASE?: Hyperdrive }).DATABASE
}

// False when the Worker has no DATABASE binding, such as local development
// without a Postgres DATABASE_URL. Callers skip database features then.
export function hasDatabase() {
  return databaseBinding() !== undefined
}

// Hyperdrive pools connections at the edge, so each request opens its own
// client and closes it once the response is sent.
export async function withDatabase<T>(
  work: (db: Database) => Promise<T>,
): Promise<T> {
  const binding = databaseBinding()
  if (!binding) {
    throw new Error('The DATABASE binding is not configured.')
  }

  const client = new Client({ connectionString: binding.connectionString })
  await client.connect()
  try {
    return await work(drizzle(client, { schema }))
  } finally {
    waitUntil(client.end())
  }
}

// For SQL that Drizzle's query builder doesn't cover, such as migrations.
export async function withDatabaseClient<T>(
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const binding = databaseBinding()
  if (!binding) {
    throw new Error('The DATABASE binding is not configured.')
  }

  const client = new Client({ connectionString: binding.connectionString })
  await client.connect()
  try {
    return await work(client)
  } finally {
    waitUntil(client.end())
  }
}
