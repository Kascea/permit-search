import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { withDatabase } from '#/lib/db/client.server'
import type { Database } from '#/lib/db/client.server'
import * as schema from '#/lib/db/schema'

// Built per request: each request has its own Hyperdrive client, so the auth
// instance can't be shared across requests.
function createAuth(db: Database) {
  return betterAuth({
    appName: 'Permit Search',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
    // No email sender yet, so there's no verification or password reset.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },
    trustedOrigins: [
      'https://permitsearch.app',
      'https://www.permitsearch.app',
      'http://localhost:3000',
    ],
    session: {
      // A signed cookie answers most session checks without a database query.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      // Deleting a user cascades to their sessions, accounts, and drafts.
      deleteUser: { enabled: true },
    },
    // Must stay last so it can set cookies from server functions.
    plugins: [tanstackStartCookies()],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type SessionUser = Auth['$Infer']['Session']['user']

export function withAuth<T>(work: (auth: Auth) => Promise<T>): Promise<T> {
  return withDatabase((db) => work(createAuth(db)))
}

// The signed-in user for these request headers, or null.
export async function getSessionUser(
  headers: Headers,
): Promise<SessionUser | null> {
  // Most visitors never sign in; skip opening a database connection for them.
  // The cookie is "__Secure-" prefixed over HTTPS.
  if (!headers.get('cookie')?.includes('better-auth.session_token=')) {
    return null
  }
  const session = await withAuth((auth) => auth.api.getSession({ headers }))
  return session?.user ?? null
}

export async function requireUserId(headers: Headers): Promise<string> {
  const user = await getSessionUser(headers)
  if (!user) {
    throw new Error('Sign in to save drafts to your account.')
  }
  return user.id
}
