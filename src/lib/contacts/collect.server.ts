import { env } from 'cloudflare:workers'

import {
  buildContactReviewRequest,
  readContactReview,
} from '#/lib/contacts/contact-review'
import {
  extractContactCandidates,
  hasContactCandidates,
} from '#/lib/contacts/extract'
import type { PageLink } from '#/lib/contacts/extract'
import type { OfficeContact, OfficeType } from '#/lib/contacts/types'
import { createTypeSafeClient } from '#/lib/search/typesafe.server'

const PAGE_FETCH_TIMEOUT_MS = 8_000
const SEARCH_TIMEOUT_MS = 10_000
const MAX_CONTACT_LINKS_TO_FOLLOW = 3
const MAX_SEARCH_PAGES = 3

export interface CollectInput {
  name: string
  region: string
  // Pages saved from earlier collections and searches, read first.
  savedUrls: Array<string>
}

export interface CollectedContacts {
  status: 'found' | 'partial' | 'not_found'
  offices: Array<OfficeContact>
  portalUrl: string | null
}

// Reads the cheapest pages first: saved URLs, then contact links on them, then
// a fresh web search, stopping once an office has a phone or email.
export async function collectCityContacts(
  input: CollectInput,
): Promise<CollectedContacts> {
  const city = `${input.name}, ${input.region}`
  const visited = new Set<string>()
  const offices = new Map<OfficeType, OfficeContact>()
  // Assigned inside reviewPages, so TypeScript can't narrow it from null.
  let portalUrl = null as string | null
  const contactLinks: Array<PageLink> = []

  const reviewPages = async (urls: Array<string>) => {
    const pending = urls.filter((url) => !visited.has(url))
    pending.forEach((url) => visited.add(url))
    const results = await Promise.all(
      pending.map((url) => reviewPage(city, url)),
    )
    for (const result of results) {
      if (!result) {
        continue
      }
      contactLinks.push(...result.contactLinks)
      portalUrl ??= result.portalUrl
      if (result.office) {
        mergeOffice(offices, result.office)
      }
    }
  }
  const hasReachableOffice = () =>
    [...offices.values()].some(({ phone, email }) => phone || email)

  await reviewPages(input.savedUrls)

  if (!hasReachableOffice()) {
    await reviewPages(
      contactLinks.map(({ url }) => url).slice(0, MAX_CONTACT_LINKS_TO_FOLLOW),
    )
  }

  if (!hasReachableOffice()) {
    const searchUrls = await searchContactPages(input)
    await reviewPages(searchUrls)
    if (!hasReachableOffice()) {
      await reviewPages(
        contactLinks
          .map(({ url }) => url)
          .slice(0, MAX_CONTACT_LINKS_TO_FOLLOW),
      )
    }
  }

  const officeList = [...offices.values()]
  const status = officeList.some(
    ({ phone, email, streetAddress }) =>
      (phone || email) && (streetAddress || (phone && email)),
  )
    ? 'found'
    : officeList.length > 0 || portalUrl
      ? 'partial'
      : 'not_found'

  console.log(
    JSON.stringify({
      message: 'city contacts collected',
      city,
      status,
      pagesRead: visited.size,
      offices: officeList.map(({ officeType, sourceUrl }) => ({
        officeType,
        sourceUrl,
      })),
      portalUrl,
    }),
  )

  return { status, offices: officeList, portalUrl }
}

async function reviewPage(city: string, url: string) {
  const html = await fetchHtml(url)
  if (!html) {
    return null
  }

  const candidates = extractContactCandidates(html, url)
  if (!hasContactCandidates(candidates)) {
    return {
      office: null,
      portalUrl: null,
      contactLinks: candidates.contactLinks,
    }
  }

  const { answers } = await createTypeSafeClient().systemOne(
    buildContactReviewRequest(city, url, candidates),
  )
  const review = readContactReview(url, answers)

  console.log(
    JSON.stringify({
      message: review.office
        ? 'jev found contact page'
        : 'jev skipped contact page',
      url,
      rightJurisdiction: review.rightJurisdiction,
      listsPermitOffice: review.listsPermitOffice,
      officeType: review.office?.officeType,
      fields: review.office
        ? Object.entries(review.office)
            .filter(
              ([key, value]) =>
                value && key !== 'officeType' && key !== 'sourceUrl',
            )
            .map(([key]) => key)
        : [],
      portalUrl: review.portalUrl,
    }),
  )

  return {
    office: review.office,
    portalUrl: review.portalUrl,
    // Only follow links from pages that are the city's own.
    contactLinks:
      review.rightJurisdiction >= 0.7 ? candidates.contactLinks : [],
  }
}

// Fills fields a page left empty from later pages for the same office.
function mergeOffice(
  offices: Map<OfficeType, OfficeContact>,
  office: OfficeContact,
) {
  const existing = offices.get(office.officeType)
  if (!existing) {
    offices.set(office.officeType, office)
    return
  }
  offices.set(office.officeType, {
    ...existing,
    name: existing.name ?? office.name,
    phone: existing.phone ?? office.phone,
    email: existing.email ?? office.email,
    streetAddress: existing.streetAddress ?? office.streetAddress,
    hours: existing.hours ?? office.hours,
  })
}

async function fetchHtml(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
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
          message: 'contact page returned unusable content',
          url,
          status: response.status,
          contentType,
        }),
      )
      return null
    }
    return await response.text()
  } catch (error) {
    console.warn(
      JSON.stringify({
        message: 'contact page fetch failed',
        url,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// Official-looking pages that mention the city, from one Tavily search.
async function searchContactPages({ name, region }: CollectInput) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  const query = `"${name}" ${region} building inspections permit office phone address hours`

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.TAVILY_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 10,
        include_answer: false,
        include_raw_content: false,
        country: 'united states',
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Tavily returned ${response.status}`)
    }

    const payload = await response.json<{
      results?: Array<{ url?: unknown }>
    }>()
    const compactName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const urls = (payload.results ?? [])
      .map(({ url }) => (typeof url === 'string' ? url : ''))
      .filter((url) => {
        try {
          const { hostname, pathname } = new URL(url)
          const host = hostname.replace(/^www\./, '')
          return (
            (host.endsWith('.gov') ||
              host.endsWith('.us') ||
              host.replace(/[^a-z0-9]/g, '').includes(compactName)) &&
            !/\.(?:pdf|docx?|xlsx?)$/i.test(pathname)
          )
        } catch {
          return false
        }
      })
      .slice(0, MAX_SEARCH_PAGES)

    console.log(
      JSON.stringify({ message: 'contact search completed', query, urls }),
    )
    return urls
  } finally {
    clearTimeout(timeout)
  }
}
