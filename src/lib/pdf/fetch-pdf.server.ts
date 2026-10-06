const PDF_FETCH_TIMEOUT_MS = 10_000
const MAX_PDF_BYTES = 12 * 1024 * 1024

export async function fetchPdfBytes(value: string) {
  const url = validatePublicPdfUrl(value)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/pdf',
        'User-Agent': 'PermitSearchBot/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`The PDF server returned ${response.status}.`)
    }

    const contentLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES) {
      throw new Error('This PDF is too large to edit here.')
    }

    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw new Error('This PDF is too large to edit here.')
    }

    if (!hasPdfSignature(bytes)) {
      throw new Error('The selected link did not return a PDF.')
    }

    return bytes
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The PDF took too long to download.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function validatePublicPdfUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only web-hosted PDFs can be opened.')
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe80:') ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error('That PDF address is not allowed.')
  }

  return url
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
