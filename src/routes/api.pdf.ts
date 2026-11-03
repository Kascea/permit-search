import { createFileRoute } from '@tanstack/react-router'

import { errorMessage, isUserError } from '#/lib/errors'
import { fetchPdfBytes } from '#/lib/pdf/fetch-pdf.server'
import { limitRequest } from '#/lib/rate-limit.server'

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
          await limitRequest('pdf', request.headers)
        } catch (error) {
          return Response.json(
            { error: errorMessage(error, 'Too many requests.') },
            { status: 429 },
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
          if (!isUserError(error)) {
            console.error(
              JSON.stringify({
                message: 'PDF proxy failed',
                sourceUrl,
                error: error instanceof Error ? error.message : String(error),
              }),
            )
          }

          return Response.json(
            { error: errorMessage(error, 'The PDF could not be opened.') },
            { status: 502 },
          )
        }
      },
    },
  },
})
