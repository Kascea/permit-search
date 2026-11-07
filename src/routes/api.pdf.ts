import { createFileRoute } from '@tanstack/react-router'

import { errorMessage, isUserError } from '#/lib/errors'
import { readBlankPdf } from '#/lib/pdf/blank-pdf.server'
import { PdfGoneError, fetchPdfBytes } from '#/lib/pdf/fetch-pdf.server'
import { limitRequest } from '#/lib/rate-limit.server'

// A saved blank form's stored copy. The hash names the bytes, so it never
// changes and can be cached for good. Blank city forms hold no answers, so
// they're served to anyone with the hash.
async function storedBlankPdf(sourceHash: string) {
  const bytes = await readBlankPdf(sourceHash)

  if (!bytes) {
    return Response.json({ error: 'That PDF wasn’t found.' }, { status: 404 })
  }

  return new Response(bytes, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline; filename="permit.pdf"',
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export const Route = createFileRoute('/api/pdf')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const sourceHash = params.get('hash')

        if (sourceHash !== null) return storedBlankPdf(sourceHash)

        const sourceUrl = params.get('url')

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
            // The editor treats a form the city removed differently from one
            // it couldn't reach; see openForm.
            { status: error instanceof PdfGoneError ? 404 : 502 },
          )
        }
      },
    },
  },
})
