import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'permit-search',
    compatibilityDate: '2026-10-05',
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
              ...(process.env.DATABASE_URL
                ? {
                    dev: {
                      connectionString: process.env.DATABASE_URL,
                    },
                  }
                : {}),
            }),
          }
        : {}),
    },
  },
})
