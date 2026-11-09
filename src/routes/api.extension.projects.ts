import { createFileRoute } from '@tanstack/react-router'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { extensionResponse, signedOut } from '#/lib/extension/api.server'
import { listProjects } from '#/lib/projects/projects.server'

// The signed-in user's projects, for the browser extension to fill forms from.
export const Route = createFileRoute('/api/extension/projects')({
  server: {
    handlers: {
      GET: ({ request }) =>
        extensionResponse(request, async () => ({
          projects: await withUserDatabase(
            request.headers,
            (userId, db) => listProjects(db, userId),
            signedOut,
          ),
        })),
    },
  },
})
