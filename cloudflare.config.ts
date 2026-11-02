import { bindings, defineConfig } from 'cf/config'

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

export default defineConfig({
  worker: {
    name: 'permit-search',
    compatibilityDate: '2026-10-05',
    // node-postgres needs Node's net, tls, and crypto modules.
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: '@tanstack/react-start/server-entry',
    domains: ['permitsearch.app', 'www.permitsearch.app'],
    observability: {
      enabled: true,
      traces: {
        enabled: true,
      },
    },
    env: {
      TAVILY_API_KEY: bindings.secret(),
      TYPESAFE_API_KEY: bindings.secret(),
      ...(process.env.CLOUDFLARE_HYPERDRIVE_ID
        ? {
            DATABASE: bindings.hyperdrive({
              id: process.env.CLOUDFLARE_HYPERDRIVE_ID,
              ...(localDatabaseUrl
                ? { dev: { connectionString: localDatabaseUrl } }
                : {}),
            }),
            // Guards the migration endpoint.
            MIGRATION_TOKEN: bindings.secret(),
          }
        : {}),
    },
  },
})
