import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { getSessionUser } from '#/lib/auth/auth.server'

export interface AccountUser {
  id: string
  name: string
  email: string
  image: string | null
}

export interface AuthState {
  user: AccountUser | null
}

// Every page loads this, so a failed session check shows the visitor as
// signed out rather than failing the whole site.
export const getAuthState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthState> => {
    const user = await getSessionUser(new Headers(getRequestHeaders())).catch(
      (cause: unknown) => {
        console.error(
          JSON.stringify({
            message: 'session check failed',
            error: cause instanceof Error ? cause.message : String(cause),
          }),
        )

        return null
      },
    )

    return {
      user: user && {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
      },
    }
  },
)
