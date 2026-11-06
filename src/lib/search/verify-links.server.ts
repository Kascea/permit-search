import { isPdfUrl } from '#/lib/pdf/url'
import { embeddedPdfUrl, looksLikePdfViewer } from '#/lib/pdf/viewer-page'
import type { PermitSearchResult } from '#/lib/search/types'

const LINK_CHECK_TIMEOUT_MS = 5_000
const USER_AGENT = 'PermitSearchBot/1.0'

// Enough to recognize a PDF, and usually to see a page's title.
const START_BYTES = 16_384
const MAX_VIEWER_PAGE_BYTES = 512_000

// What opening the link shows. "unknown" when the site blocked the check or
// didn't answer in time: many city sites turn away automated requests, so the
// link is kept rather than treated as missing. "missing" also covers a site
// that can't be reached at all, such as a retired hostname. For "pdf", url is
// the file itself, which a viewer page's link isn't.
type LinkCheck =
  | { kind: 'missing' | 'page' | 'unknown' }
  | { kind: 'pdf'; url: string }

// Drops links that no longer exist. A link is only called a PDF once its bytes
// have been seen: its address isn't evidence, and search indexes keep links to
// files a city has since taken down. One that can't be checked stays as an
// ordinary link.
export async function verifyLinks(
  links: Array<PermitSearchResult>,
): Promise<Array<PermitSearchResult>> {
  const checks = await Promise.all(links.map(({ url }) => checkLink(url)))
  const seenFiles = new Set<string>()

  return links.flatMap((link, index) => {
    const check = checks[index]

    // A link named like a PDF that opens a web page with no file in it is an
    // error or sign-in page, not the form.
    if (
      check?.kind === 'missing' ||
      (check?.kind === 'page' && isPdfUrl(link.url))
    ) {
      console.log(
        JSON.stringify({
          message: 'link check dropped link',
          url: link.url,
          title: link.title,
          check: check.kind,
        }),
      )

      return []
    }

    if (check?.kind !== 'pdf') return { ...link, isPdf: false }

    // Two viewer links can open the same file.
    if (seenFiles.has(check.url)) return []

    seenFiles.add(check.url)

    return { ...link, url: check.url, isPdf: true }
  })
}

async function checkLink(url: string): Promise<LinkCheck> {
  try {
    const response = await fetchLink(url, true)

    // 530 is how Cloudflare reports a hostname that doesn't resolve.
    if ([404, 410, 530].includes(response.status)) {
      await response.body?.cancel()

      return { kind: 'missing' }
    }

    if (!response.ok) {
      await response.body?.cancel()

      return { kind: 'unknown' }
    }

    const start = await readBytes(response, START_BYTES)

    if (hasPdfSignature(start)) return { kind: 'pdf', url }

    const pageUrl = response.url || url

    if (!looksLikePdfViewer(new TextDecoder().decode(start), pageUrl)) {
      return { kind: 'page' }
    }

    const file = await viewerFile(pageUrl)

    return file ? { kind: 'pdf', url: file } : { kind: 'page' }
  } catch (error) {
    // A timeout, or the Worker's limit on requests, says nothing about the
    // link. Any other failure means the site can't be reached.
    const couldNotCheck =
      error instanceof Error &&
      (error.name === 'TimeoutError' || /subrequests/i.test(error.message))

    return { kind: couldNotCheck ? 'unknown' : 'missing' }
  }
}

// The PDF a viewer page shows, confirmed by its bytes; null when there's none.
async function viewerFile(pageUrl: string) {
  try {
    const page = await fetchLink(pageUrl, false)

    if (!page.ok) {
      await page.body?.cancel()

      return null
    }

    const html = new TextDecoder().decode(
      await readBytes(page, MAX_VIEWER_PAGE_BYTES),
    )

    const file = embeddedPdfUrl(html, pageUrl)

    if (!file) return null

    // A download flag would make clicking the link save the file instead of
    // opening it, so that address is preferred without it.
    const inline = new URL(file)
    inline.searchParams.delete('download')

    for (const candidate of new Set([inline.toString(), file])) {
      const response = await fetchLink(candidate, true)

      const isPdf =
        response.ok && hasPdfSignature(await readBytes(response, START_BYTES))

      if (isPdf) return candidate
    }

    return null
  } catch {
    return null
  }
}

function fetchLink(url: string, startOnly: boolean) {
  return fetch(url, {
    headers: {
      // A server may ignore this and send the whole file, so readBytes stops
      // reading either way.
      ...(startOnly && { Range: `bytes=0-${START_BYTES - 1}` }),
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(LINK_CHECK_TIMEOUT_MS),
  })
}

async function readBytes(response: Response, limit: number) {
  const reader = response.body?.getReader()
  const bytes = new Uint8Array(limit)
  let length = 0

  if (!reader) return bytes.subarray(0, 0)

  while (length < limit) {
    const { done, value } = await reader.read()

    if (done) break

    const chunk = value.subarray(0, limit - length)
    bytes.set(chunk, length)
    length += chunk.length
  }

  await reader.cancel()

  return bytes.subarray(0, length)
}

function hasPdfSignature(bytes: Uint8Array) {
  return String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-'
}
