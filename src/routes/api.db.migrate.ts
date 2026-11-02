import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'

import { hasDatabase } from '#/lib/db/client.server'
import { runMigrations } from '#/lib/db/migrate.server'

// Applies pending database migrations through Hyperdrive. Called by
// `npm run db:migrate` with the MIGRATION_TOKEN secret.
export const Route = createFileRoute('/api/db/migrate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (env as { MIGRATION_TOKEN?: string }).MIGRATION_TOKEN
        if (
          !token ||
          request.headers.get('Authorization') !== `Bearer ${token}`
        ) {
          return Response.json({ error: 'Not found.' }, { status: 404 })
        }

        if (!hasDatabase()) {
          return Response.json(
            { error: 'The DATABASE binding is not configured.' },
            { status: 503 },
          )
        }

        try {
          return Response.json(await runMigrations())
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error ? error.message : 'Migration failed.',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
