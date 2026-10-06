import { createFileRoute } from '@tanstack/react-router'

import { fetchPdfBytes } from '#/lib/pdf/fetch-pdf.server'

export const Route = createFileRoute('/api/pdf')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sourceUrl = new URL(request.url).searchParams.get('url')
        if (!sourceUrl) {
          return Response.json(
            { error: 'A PDF URL is required.' },
            { status: 400 },
          )
        }

        try {
          const bytes = await fetchPdfBytes(sourceUrl)

          return new Response(bytes, {
            headers: {
              'Cache-Control': 'private, max-age=300',
              'Content-Disposition': 'inline; filename="permit.pdf"',
              'Content-Type': 'application/pdf',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        } catch (error) {
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'The PDF could not be opened.',
            },
            { status: 502 },
          )
        }
      },
    },
  },
})
