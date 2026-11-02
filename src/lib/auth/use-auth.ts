import { getRouteApi } from '@tanstack/react-router'

import type { AuthState } from '#/lib/auth/session'

const rootRoute = getRouteApi('__root__')

// The visitor's sign-in state, loaded once by the root route. Call
// router.invalidate() after signing out to reload it.
export function useAuth(): AuthState {
  return rootRoute.useLoaderData()
}
