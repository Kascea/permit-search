import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'permit-search',
    compatibilityDate: '2026-10-05',
    entrypoint: '@tanstack/react-start/server-entry',
    observability: {
      enabled: true,
      traces: {
        enabled: true,
      },
    },
    env: process.env.CLOUDFLARE_HYPERDRIVE_ID
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
      : {},
  },
})
