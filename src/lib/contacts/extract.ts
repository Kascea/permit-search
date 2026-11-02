// Finds candidate contact details in a page's HTML. Code finds every phone
// number, email, address, and so on; Jev then picks which belong to the permit
// office (see contact-review.ts), so saved values always appear on the page.

const MAX_CANDIDATES = 8
const MAX_CONTEXT_LENGTH = 160

export interface Candidate {
  value: string
  // The surrounding text, such as "Inspections: 952.924.2588".
  context: string
}

export interface PageLink {
  url: string
  text: string
}

export interface ContactCandidates {
  title: string
  officeNames: Array<Candidate>
  phones: Array<Candidate>
  emails: Array<Candidate>
  addresses: Array<Candidate>
  hours: Array<Candidate>
  portalLinks: Array<PageLink>
  // Same-site links that may lead to a contact page.
  contactLinks: Array<PageLink>
}

const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const STREET_PATTERN =
  /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Za-z0-9.' -]{2,40}?\s(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Parkway|Pkwy|Court|Ct|Place|Pl|Highway|Hwy|Circle|Cir|Trail|Trl|Square|Sq)\b\.?(?:,?\s*(?:Suite|Ste|Room|Rm|Floor|Fl)\.?\s*[\w-]+)?(?:,?\s*[A-Za-z .'-]+,?\s+[A-Z]{2}\.?\s+\d{5}(?:-\d{4})?)?/g
const ZIP_LINE_PATTERN = /^[A-Za-z .'-]+,?\s+[A-Z]{2}\.?\s+\d{5}(?:-\d{4})?$/
const DAY_PATTERN =
  /\b(?:Mon(?:day)?|Tue(?:s|sday)?|Wed(?:nesday)?|Thu(?:rs|rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?|weekdays)\b/i
const TIME_PATTERN = /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)/i
const OFFICE_NAME_PATTERN =
  /\b(?:Department|Division|Inspections?|Building|Planning|Zoning|Development|Permits?|Code Enforcement|Community Services)\b/i
const CONTACT_LINK_PATTERN =
  /\b(?:contact|inspections?|building|planning|zoning|permits?|development services)\b/i
const PORTAL_PATTERN =
  /\be-?permits?\b|apply online|online permit|permit portal|permitting portal|citizen ?access|accela|etrakit|energov|tylerhost|viewpointcloud|cityview|permits online/i

export function extractContactCandidates(
  html: string,
  pageUrl: string,
): ContactCandidates {
  const page = new URL(pageUrl)
  const lines = htmlToLines(html)
  const links = extractLinks(html, page)

  const phones = new Map<string, Candidate>()
  const emails = new Map<string, Candidate>()
  const addresses = new Map<string, Candidate>()
  const hours = new Map<string, Candidate>()
  const officeNames = new Map<string, Candidate>()

  lines.forEach((line, index) => {
    const context = contextFor(lines, index)

    for (const match of line.matchAll(PHONE_PATTERN)) {
      addCandidate(phones, match[0].replace(/\D/g, '').slice(-10), {
        value: match[0].trim(),
        context,
      })
    }
    for (const match of line.matchAll(EMAIL_PATTERN)) {
      addCandidate(emails, match[0].toLowerCase(), {
        value: match[0].toLowerCase(),
        context,
      })
    }
    for (const match of line.matchAll(STREET_PATTERN)) {
      let address = match[0].trim()
      const nextLine = lines.at(index + 1) ?? ''
      if (!/\d{5}/.test(address) && ZIP_LINE_PATTERN.test(nextLine)) {
        address = `${address}, ${nextLine}`
      }
      addCandidate(addresses, address.toLowerCase(), {
        value: address,
        context,
      })
    }
    if (
      line.length <= 120 &&
      DAY_PATTERN.test(line) &&
      TIME_PATTERN.test(line)
    ) {
      addCandidate(hours, line.toLowerCase(), { value: line, context })
    }
    if (
      line.length <= 80 &&
      OFFICE_NAME_PATTERN.test(line) &&
      !/\d{3}/.test(line)
    ) {
      addCandidate(officeNames, line.toLowerCase(), { value: line, context })
    }
  })

  for (const link of links) {
    if (link.url.startsWith('mailto:')) {
      const email = decodeURIComponent(link.url.slice(7).split('?')[0])
      if (EMAIL_PATTERN.test(email)) {
        addCandidate(emails, email.toLowerCase(), {
          value: email.toLowerCase(),
          context: link.text || email,
        })
      }
      EMAIL_PATTERN.lastIndex = 0
    }
  }

  const webLinks = links.filter(({ url }) => url.startsWith('http'))
  const portalLinks = uniqueLinks(
    webLinks.filter(
      ({ url, text }) => PORTAL_PATTERN.test(text) || PORTAL_PATTERN.test(url),
    ),
  )
  const contactLinks = uniqueLinks(
    webLinks.filter(({ url, text }) => {
      const target = new URL(url)
      return (
        target.hostname === page.hostname &&
        target.pathname !== page.pathname &&
        !/\.(?:pdf|docx?|xlsx?)$/i.test(target.pathname) &&
        CONTACT_LINK_PATTERN.test(text)
      )
    }),
  )

  return {
    title: extractTitle(html),
    officeNames: [...officeNames.values()].slice(0, MAX_CANDIDATES),
    phones: [...phones.values()].slice(0, MAX_CANDIDATES),
    emails: [...emails.values()].slice(0, MAX_CANDIDATES),
    addresses: [...addresses.values()].slice(0, MAX_CANDIDATES),
    hours: [...hours.values()].slice(0, MAX_CANDIDATES),
    portalLinks: portalLinks.slice(0, MAX_CANDIDATES),
    contactLinks: contactLinks.slice(0, MAX_CANDIDATES),
  }
}

export function hasContactCandidates(candidates: ContactCandidates) {
  return (
    candidates.phones.length > 0 ||
    candidates.emails.length > 0 ||
    candidates.addresses.length > 0 ||
    candidates.portalLinks.length > 0
  )
}

function htmlToLines(html: string) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(
      /<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/th|\/dd|\/dt|\/address|\/section|\/header|\/footer|\/article)\b[^>]*>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ')

  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function extractLinks(html: string, page: URL): Array<PageLink> {
  const links: Array<PageLink> = []
  for (const match of html.matchAll(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
    const href = decodeEntities(match[1].trim())
    if (href.startsWith('mailto:')) {
      links.push({ url: href, text })
      continue
    }
    try {
      const url = new URL(href, page)
      url.hash = ''
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        links.push({ url: url.toString(), text })
      }
    } catch {
      // Not a usable URL.
    }
  }
  return links
}

function extractTitle(html: string) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : ''
}

// A line alone is often just "952.924.2588", so include the line before it.
function contextFor(lines: Array<string>, index: number) {
  const line = lines[index]
  const context =
    line.length < 40 && index > 0 ? `${lines[index - 1]} — ${line}` : line
  return context.slice(0, MAX_CONTEXT_LENGTH)
}

function addCandidate(
  candidates: Map<string, Candidate>,
  key: string,
  candidate: Candidate,
) {
  if (!candidates.has(key)) {
    candidates.set(key, candidate)
  }
}

function uniqueLinks(links: Array<PageLink>) {
  const seen = new Set<string>()
  return links.filter(({ url }) => {
    if (seen.has(url)) {
      return false
    }
    seen.add(url)
    return true
  })
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
}
