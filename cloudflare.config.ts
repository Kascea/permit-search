import { bindings, defineConfig } from 'cf/config'
import type { HyperdriveBinding } from 'cf/config'

// The config runs in Node, which doesn't read .env on its own.
try {
  process.loadEnvFile()
} catch {
  // No .env file: rely on the shell's environment.
}

// Hyperdrive needs a direct Postgres connection string for local development.
const localDatabaseUrl = process.env.DATABASE_URL?.startsWith('postgres')
  ? process.env.DATABASE_URL
  : undefined

interface DatabaseBindings {
  DATABASE?: HyperdriveBinding
}

// The database, when a Hyperdrive config is set up. Without one the app runs
// with its database features turned off; see hasDatabase().
function databaseBinding(): DatabaseBindings {
  const id = process.env.CLOUDFLARE_HYPERDRIVE_ID

  if (!id) return {}

  if (!localDatabaseUrl) return { DATABASE: bindings.hyperdrive({ id }) }

  return {
    DATABASE: bindings.hyperdrive({
      id,
      dev: { connectionString: localDatabaseUrl },
    }),
  }
}

export default defineConfig({
  worker: {
    name: 'permit-search',
    compatibilityDate: '2026-10-05',
    // node-postgres needs Node's net, tls, and crypto modules.
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: '@tanstack/react-start/server-entry',
    domains: ['permitsearch.app', 'www.permitsearch.app'],
    // Runs next to the PlanetScale database (AWS us-east-2) instead of near
    // each visitor: a request makes several database round trips in a row,
    // and each is far shorter from there. Static assets still serve from the
    // edge.
    placement: { region: 'aws:us-east-2' },
    observability: {
      enabled: true,
      traces: {
        enabled: true,
      },
    },
    env: {
      TAVILY_API_KEY: bindings.secret(),
      TYPESAFE_API_KEY: bindings.secret(),
      // Better Auth: email/password and Google sign-in.
      BETTER_AUTH_SECRET: bindings.secret(),
      BETTER_AUTH_URL: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      // Per client IP and kind of request: searches, contact lookups, result
      // reports and PDF downloads. See limitRequest().
      RATE_LIMITER: bindings.rateLimit({
        namespace: '1001',
        simple: { limit: 10, period: 60 },
      }),
      ...databaseBinding(),
    },
  },
})
