import type { PermitType } from '#/lib/search/permit-types'
import type { PermitSearchInput, PermitSearchResult } from '#/lib/search/types'

const PAGE_FETCH_TIMEOUT_MS = 8_000
const MAX_LINKS_PER_PAGE = 20

const GENERIC_PERMIT_WORDS = new Set([
  'application',
  'applications',
  'form',
  'forms',
  'permit',
  'permits',
  'requirement',
  'requirements',
])

interface ExtractedLink {
  href: string
  text: string
  section: string
}

export async function extractRelevantOfficialLinks(
  page: PermitSearchResult,
  input: PermitSearchInput,
  permitTypes: Array<PermitType>,
): Promise<Array<PermitSearchResult>> {
  const pageUrl = new URL(page.url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(pageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'PermitSearchBot/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    const contentType = response.headers.get('content-type') ?? ''

    if (!response.ok || !contentType.toLowerCase().includes('text/html')) {
      console.warn(
        JSON.stringify({
          message: 'official permit page returned unusable content',
          url: page.url,
          status: response.status,
          contentType,
        }),
      )
      return []
    }

    const links: Array<ExtractedLink> = []
    const headingHandler = new HeadingHandler()
    const linkHandler = new LinkHandler(links, () => headingHandler.heading)
    const transformed = new HTMLRewriter()
      .on('h1, h2, h3, h4', headingHandler)
      .on('a[href]', linkHandler)
      .transform(response)

    await transformed.body?.pipeTo(new WritableStream())

    return links
      .map((link) => normalizeLink(link, pageUrl, page, input, permitTypes))
      .filter((link): link is PermitSearchResult => link !== null)
      .sort((first, second) => second.score - first.score)
      .slice(0, MAX_LINKS_PER_PAGE)
  } catch (error) {
    console.warn(
      JSON.stringify({
        message: 'official permit page extraction failed',
        url: page.url,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    return []
  } finally {
    clearTimeout(timeout)
  }
}

class HeadingHandler implements HTMLRewriterElementContentHandlers {
  heading = ''
  private currentHeading = ''

  element(element: Element) {
    this.currentHeading = ''
    element.onEndTag(() => {
      this.heading = normalizeWhitespace(this.currentHeading)
      this.currentHeading = ''
    })
  }

  text(text: Text) {
    this.currentHeading += text.text
  }
}

class LinkHandler implements HTMLRewriterElementContentHandlers {
  private currentLink?: ExtractedLink

  constructor(
    private readonly links: Array<ExtractedLink>,
    private readonly getSection: () => string,
  ) {}

  element(element: Element) {
    const href = element.getAttribute('href')
    if (!href) {
      return
    }

    const link = { href, text: '', section: this.getSection() }
    this.currentLink = link
    element.onEndTag(() => {
      link.text = normalizeWhitespace(link.text)
      this.links.push(link)
      if (this.currentLink === link) {
        this.currentLink = undefined
      }
    })
  }

  text(text: Text) {
    if (this.currentLink) {
      this.currentLink.text += text.text
    }
  }
}

function normalizeLink(
  link: ExtractedLink,
  pageUrl: URL,
  page: PermitSearchResult,
  input: PermitSearchInput,
  permitTypes: Array<PermitType>,
): PermitSearchResult | null {
  try {
    const url = new URL(link.href, pageUrl)
    url.hash = ''
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      isSamePage(url, pageUrl) ||
      !matchesPermit(link, url, input.permit, permitTypes)
    ) {
      return null
    }

    const domain = url.hostname.replace(/^www\./, '')
    return {
      title: cleanLinkTitle(link.text) || titleFromUrl(url),
      url: url.toString(),
      domain,
      description: link.section
        ? `Official link listed under “${link.section}” on ${page.title}.`
        : `Official link found on ${page.title}.`,
      score: 10_000 + page.score + scoreLink(link, url, input.permit),
      isGovernmentSource: isGovernmentDomain(domain),
    }
  } catch {
    return null
  }
}

// Links back to the page itself are page chrome: in-page anchors such as
// "Skip to main content", or query variants such as a language picker's ?oc_lang=en-US.
function isSamePage(url: URL, pageUrl: URL) {
  return (
    url.hostname.replace(/^www\./, '') ===
      pageUrl.hostname.replace(/^www\./, '') &&
    url.pathname.replace(/\/$/, '').toLowerCase() ===
      pageUrl.pathname.replace(/\/$/, '').toLowerCase()
  )
}

function matchesPermit(
  link: ExtractedLink,
  url: URL,
  permit: string,
  permitTypes: Array<PermitType>,
) {
  const searchable = normalizeText(
    `${link.text} ${link.section} ${decodeURIComponent(url.pathname)}`,
  )
  const allKeywords = permitKeywords(permit)
  const specificKeywords = allKeywords.filter(
    (keyword) => !GENERIC_PERMIT_WORDS.has(keyword),
  )
  const requiredKeywords = [
    ...(specificKeywords.length > 0 ? specificKeywords : allKeywords),
    // "building" for a building permit, so a bathroom search keeps a
    // "Residential building permit application" link.
    ...permitTypes.map(({ name }) =>
      normalizeText(name.replace(/ permit$/, '')),
    ),
  ]

  return requiredKeywords.some((keyword) => includesPhrase(searchable, keyword))
}

function scoreLink(link: ExtractedLink, url: URL, permit: string) {
  const searchable = normalizeText(
    `${link.text} ${link.section} ${decodeURIComponent(url.pathname)}`,
  )
  const normalizedPermit = normalizeText(permit)
  const matchingKeywords = permitKeywords(permit).filter((keyword) =>
    includesPhrase(searchable, keyword),
  ).length
  let score = matchingKeywords * 100

  if (searchable.includes(normalizedPermit)) {
    score += 500
  }

  if (url.pathname.toLowerCase().endsWith('.pdf')) {
    score += 300
  }

  if (/\b(application|apply|form)\b/.test(searchable)) {
    score += 250
  }

  return score
}

function permitKeywords(permit: string) {
  return normalizeText(permit)
    .split(' ')
    .filter((keyword) => keyword.length > 2)
}

function cleanLinkTitle(value: string) {
  return normalizeWhitespace(value)
    .replace(/\(\s*pdf\b[^)]*\)\s*$/i, '')
    .trim()
}

function titleFromUrl(url: URL) {
  const filename = decodeURIComponent(
    url.pathname.split('/').filter(Boolean).at(-1) ?? 'Permit link',
  )

  return filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function includesPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `)
}

function isGovernmentDomain(domain: string) {
  return (
    domain.endsWith('.gov') ||
    domain.includes('.gov.') ||
    domain.endsWith('.us')
  )
}
