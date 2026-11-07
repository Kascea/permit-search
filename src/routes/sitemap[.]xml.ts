import { createFileRoute } from '@tanstack/react-router'

import { hasDatabase } from '#/lib/db/client.server'
import { listIndexableSearches } from '#/lib/saved-searches/saved-searches.server'
import { SITE_URL } from '#/lib/site'

// What search engines should list: the pages about the site, and the searches
// isIndexableSearch accepts. A failed lookup still lists the fixed pages.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const searches = hasDatabase()
          ? await listIndexableSearches().catch((cause: unknown) => {
              console.error(
                JSON.stringify({
                  message: 'sitemap search lookup failed',
                  error: cause instanceof Error ? cause.message : String(cause),
                }),
              )

              return []
            })
          : []

        const urls = [
          `<url><loc>${SITE_URL}</loc></url>`,
          `<url><loc>${SITE_URL}about</loc></url>`,
          // Slugs hold only letters, numbers, hyphens and one slash, so they
          // need no XML escaping.
          ...searches.map(
            ({ slug, lastModified }) =>
              `<url><loc>${SITE_URL}results/${slug}</loc><lastmod>${lastModified}</lastmod></url>`,
          ),
        ]

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
          {
            headers: {
              'Cache-Control': 'public, max-age=3600',
              'Content-Type': 'application/xml; charset=utf-8',
            },
          },
        )
      },
    },
  },
})
