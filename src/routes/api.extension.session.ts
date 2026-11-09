import { createFileRoute } from '@tanstack/react-router'

import { getSessionUser } from '#/lib/auth/auth.server'
import { extensionResponse, signedOut } from '#/lib/extension/api.server'

// The browser extension's signed-in user, from the site's session cookie.
export const Route = createFileRoute('/api/extension/session')({
  server: {
    handlers: {
      GET: ({ request }) =>
        extensionResponse(request, async () => {
          const user = await getSessionUser(request.headers)

          if (!user) return signedOut()

          return { user: { name: user.name, email: user.email } }
        }),
    },
  },
})
