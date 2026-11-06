import { isPdfUrl } from '#/lib/pdf/url'

// Many sites wrap a PDF in a web page, sometimes at an address ending in .pdf.
// These find the file inside such a page from the page alone, whoever hosts
// it. What's found is only a candidate: its bytes decide whether it's a PDF.

const EMBEDDED_FILE = /<(?:embed|iframe|object)\b[^>]*?\b(?:src|data)=["']([^"']+)["']/gi
const QUOTED_ADDRESS = /["']((?:https?:\/\/|\/)[^"'\s<>]+)["']/g

// A page that only links to PDFs, such as a list of forms, doesn't count. Its
// title names a PDF, its address does, or it embeds one.
export function looksLikePdfViewer(html: string, pageUrl: string) {
  return (
    isPdfUrl(pageUrl) ||
    /<title[^>]*>[^<]*\.pdf\s*<\/title>/i.test(html) ||
    embeddedAddresses(html).some(isPdfAddress)
  )
}

// The one PDF the page shows, or null when it names none or several: several
// means a page about the files, not a viewer of one.
export function embeddedPdfUrl(html: string, pageUrl: string) {
  const embedded = embeddedAddresses(html).filter(isPdfAddress)

  const addresses =
    embedded.length > 0
      ? embedded
      : [...html.replaceAll('\\/', '/').matchAll(QUOTED_ADDRESS)].flatMap(
          ([, address = '']) => (isPdfAddress(address) ? [address] : []),
        )

  const page = fileKey(new URL(pageUrl))
  const files = new Map<string, string>()

  for (const address of addresses) {
    const url = absoluteUrl(address, pageUrl)

    if (url && fileKey(url) !== page) files.set(fileKey(url), url.toString())
  }

  return files.size === 1 ? ([...files.values()][0] ?? null) : null
}

function embeddedAddresses(html: string) {
  return [...html.matchAll(EMBEDDED_FILE)].map(([, address = '']) =>
    viewedFile(address.replaceAll('&amp;', '&')),
  )
}

// PDF.js and similar viewers name the file in a parameter, as in
// /viewer.html?file=/forms/deck.pdf.
function viewedFile(address: string) {
  return parseAddress(address)?.searchParams.get('file') ?? address
}

function isPdfAddress(address: string) {
  const url = parseAddress(address)

  return url !== null && isPdfUrl(url.href)
}

// Pages can hold anything in these attributes, so a bad address is just not a
// file. The base only lets a relative address be read.
function parseAddress(address: string) {
  try {
    return new URL(address, 'https://example.invalid')
  } catch {
    return null
  }
}

function absoluteUrl(address: string, pageUrl: string) {
  try {
    const url = new URL(address.replaceAll('&amp;', '&'), pageUrl)

    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

// Query strings aside, since a page can name one file with several.
function fileKey(url: URL) {
  return `${url.origin}${url.pathname}`
}
