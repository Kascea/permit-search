import { createFileRoute } from '@tanstack/react-router'

import { withAuth } from '#/lib/auth/auth.server'

function handleAuth({ request }: { request: Request }) {
  return withAuth((auth) => auth.handler(request))
}

// Better Auth's endpoints: email sign-in and sign-up, Google sign-in and its
// callback, session, and sign-out.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handleAuth,
      POST: handleAuth,
    },
  },
})
