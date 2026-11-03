import { UserError } from '#/lib/errors'

const PDF_FETCH_TIMEOUT_MS = 10_000
const MAX_PDF_BYTES = 12 * 1024 * 1024
const MAX_REDIRECTS = 5

export async function fetchPdfBytes(value: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS)

  try {
    const response = await fetchFollowingRedirects(value, controller.signal)

    if (!response.ok) {
      throw new UserError('The PDF couldn’t be downloaded from its website.')
    }

    const contentLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES) {
      throw new UserError('This PDF is too large to edit here.')
    }

    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw new UserError('This PDF is too large to edit here.')
    }

    if (!hasPdfSignature(bytes)) {
      throw new UserError('The selected link did not return a PDF.')
    }

    return bytes
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UserError('The PDF took too long to download.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// Redirects are followed one at a time so each address is checked, not just
// the first: a public page could otherwise redirect to a private one.
async function fetchFollowingRedirects(value: string, signal: AbortSignal) {
  let url = validatePublicPdfUrl(value)
  for (let redirects = 0; ; redirects++) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/pdf',
        'User-Agent': 'PermitSearchBot/1.0',
      },
      redirect: 'manual',
      signal,
    })

    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location) {
      return response
    }
    await response.body?.cancel()
    if (redirects === MAX_REDIRECTS) {
      throw new UserError('The PDF’s website redirected too many times.')
    }
    url = validatePublicPdfUrl(new URL(location, url).href)
  }
}

function validatePublicPdfUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UserError('Only web-hosted PDFs can be opened.')
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    isPrivateIpv6(hostname) ||
    isPrivateIpv4(hostname)
  ) {
    throw new UserError('That PDF address is not allowed.')
  }

  return url
}

// URL has already written an IPv6 host in its shortest lowercase form, with
// any embedded IPv4 address in hex, such as "::ffff:7f00:1" for 127.0.0.1.
function isPrivateIpv6(hostname: string) {
  if (!hostname.includes(':')) return false
  return (
    hostname === '::' ||
    hostname === '::1' ||
    // IPv4-mapped and NAT64 addresses can reach any IPv4 address.
    hostname.startsWith('::ffff:') ||
    hostname.startsWith('64:ff9b:') ||
    // Unique local (fc00::/7) and link-local (fe80::/10).
    /^f[cd][0-9a-f]{0,2}:/.test(hostname) ||
    /^fe[89ab][0-9a-f]?:/.test(hostname)
  )
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.')
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)
  ) {
    return false
  }

  const [first, second] = parts.map(Number)
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    // Shared address space used by carrier-grade NAT.
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  )
}

function hasPdfSignature(bytes: ArrayBuffer) {
  const signature = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 5))
  return String.fromCharCode(...signature) === '%PDF-'
}
