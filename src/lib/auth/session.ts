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

export const getAuthState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthState> => {
    const user = await getSessionUser(new Headers(getRequestHeaders()))
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
