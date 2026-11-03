import { isPdfUrl } from '#/lib/pdf/url'
import type { PermitSearchResult } from '#/lib/search/types'

const LINK_CHECK_TIMEOUT_MS = 5_000

// What opening the link shows. "unknown" when the site blocked the check or
// didn't answer in time: many city sites turn away automated requests, so the
// link is kept rather than treated as missing.
type LinkCheck = 'missing' | 'pdf' | 'page' | 'unknown'

// Drops links that no longer exist, and marks which of the rest are PDFs by
// their contents rather than their address. Search indexes keep links to
// files a city has since taken down.
export async function verifyLinks(
  links: Array<PermitSearchResult>,
): Promise<Array<PermitSearchResult>> {
  const checks = await Promise.all(links.map(({ url }) => checkLink(url)))

  return links.flatMap((link, index) => {
    const check = checks[index]

    // A link named like a PDF that opens a web page is an error or
    // sign-in page, not the form.
    if (check === 'missing' || (check === 'page' && isPdfUrl(link.url))) {
      console.log(
        JSON.stringify({
          message: 'link check dropped link',
          url: link.url,
          title: link.title,
          check,
        }),
      )

      return []
    }

    return {
      ...link,
      isPdf: check === 'unknown' ? isPdfUrl(link.url) : check === 'pdf',
    }
  })
}

async function checkLink(url: string): Promise<LinkCheck> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        // Only the start of the file is needed to recognize a PDF.
        Range: 'bytes=0-1023',
        'User-Agent': 'PermitSearchBot/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel()

      return 'missing'
    }

    if (!response.ok) {
      await response.body?.cancel()

      return 'unknown'
    }

    return (await startsWithPdfSignature(response)) ? 'pdf' : 'page'
  } catch {
    return 'unknown'
  } finally {
    clearTimeout(timeout)
  }
}

// Reads only until the signature can be checked, since a server may ignore
// the Range header and send the whole file.
async function startsWithPdfSignature(response: Response) {
  const reader = response.body?.getReader()

  if (!reader) return false

  const signature = '%PDF-'
  let start = ''

  while (start.length < signature.length) {
    const { done, value } = await reader.read()

    if (done) break

    start += String.fromCharCode(
      ...value.subarray(0, signature.length - start.length),
    )
  }

  await reader.cancel()

  return start === signature
}
