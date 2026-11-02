import { env, waitUntil } from 'cloudflare:workers'

import { saveCityPermitsUrl } from '#/lib/contacts/store.server'
import { hasDatabase, withDatabase } from '#/lib/db/client.server'
import type { ReviewedLink } from '#/lib/search/link-review.server'

import type {
  PermitSearchInput,
  PermitSearchResponse,
  PermitSearchResult,
} from '#/lib/search/types'
import { isGeneralPermitsPage } from '#/lib/search/link-review'
import { reviewPermitLinks } from '#/lib/search/link-review.server'
import type { PermitType } from '#/lib/search/permit-types'
import { identifyPermitTypes } from '#/lib/search/permit-types.server'
import { extractRelevantOfficialLinks } from '#/lib/search/official-links.server'

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const SEARCH_TIMEOUT_MS = 15_000
const MAX_RESULTS = 10
const MAX_OFFICIAL_PAGES_TO_EXTRACT = 4
const MAX_GENERAL_FALLBACK_RESULTS = 3

interface TavilySearchResult {
  title?: unknown
  url?: unknown
  content?: unknown
  score?: unknown
}

interface TavilySearchResponse {
  query?: unknown
  results?: unknown
}

export async function searchPermitsWithTavily(
  input: PermitSearchInput,
): Promise<PermitSearchResponse> {
  const permitTypes = await identifyPermitTypes(input)
  const query = buildSearchQuery(input, permitTypes)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.TAVILY_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        topic: 'general',
        max_results: 20,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_favicon: false,
        country: 'united states',
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? 'Permit search is busy. Please wait a moment and try again.'
          : 'Permit search is temporarily unavailable.',
      )
    }

    const payload = await response.json<TavilySearchResponse>()
    const tavilyResults = Array.isArray(payload.results)
      ? payload.results
          .map(normalizeResult)
          .filter((result): result is PermitSearchResult => result !== null)
      : []
    const results = tavilyResults.filter((result) => {
      const matches = matchesLocality(
        result.title,
        result.description,
        new URL(result.url),
        input,
      )
      if (!matches) {
        console.log(
          JSON.stringify({
            message: 'city filter dropped link',
            url: result.url,
            title: result.title,
          }),
        )
      }
      return matches
    })

    console.log(
      JSON.stringify({
        message: 'tavily search completed',
        query,
        returned: tavilyResults.length,
        passedCityFilter: results.length,
      }),
    )
    const officialPages = results
      .filter(
        (result) => result.isGovernmentSource && isLikelyHtmlPage(result.url),
      )
      .sort(
        (first, second) =>
          rankExtractionPage(second, input) - rankExtractionPage(first, input),
      )
      .slice(0, MAX_OFFICIAL_PAGES_TO_EXTRACT)
    const extractedByPage = await Promise.all(
      officialPages.map(async (page) => ({
        page,
        links: await extractRelevantOfficialLinks(page, input, permitTypes),
      })),
    )
    const extractedLinks = extractedByPage.flatMap(({ links }) => links)

    console.log(
      JSON.stringify({
        message: 'official permit link extraction completed',
        pages: extractedByPage.map(({ page, links }) => ({
          url: page.url,
          matchingLinks: links.length,
        })),
      }),
    )

    const reviewedLinks = await reviewPermitLinks(
      input,
      deduplicateResults([...extractedLinks, ...results]),
      permitTypes,
    )
    rememberPermitsPage(input, reviewedLinks)

    const keptLinks = reviewedLinks.filter(
      ({ rejectionReasons }) => rejectionReasons.length === 0,
    )
    // Nothing specific to the project survived: show the city's general
    // permit pages and application portal instead of an empty list.
    const isGeneralFallback = keptLinks.length === 0
    const rankedResults = (
      isGeneralFallback
        ? reviewedLinks
            .filter(({ review }) => isGeneralPermitsPage(review))
            .sort(
              (first, second) =>
                second.review.generalPermitsPage -
                first.review.generalPermitsPage,
            )
            .slice(0, MAX_GENERAL_FALLBACK_RESULTS)
        : keptLinks
            .sort(
              (first, second) =>
                second.confidentMatches - first.confidentMatches ||
                rankResult(second.link, input) - rankResult(first.link, input),
            )
            .slice(0, MAX_RESULTS)
    ).map(({ link }) => link)

    if (isGeneralFallback) {
      console.log(
        JSON.stringify({
          message: 'showing general permit pages',
          urls: rankedResults.map(({ url }) => url),
        }),
      )
    }

    return {
      query: typeof payload.query === 'string' ? payload.query : query,
      results: rankedResults,
      isGeneralFallback: isGeneralFallback && rankedResults.length > 0,
      permitTypes: permitTypes.map(({ name }) => name),
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Permit search timed out. Please try again.')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// Saves the city's main permits page, after the response is sent, so contact
// refreshes can start from it.
function rememberPermitsPage(
  { city }: PermitSearchInput,
  reviewedLinks: Array<ReviewedLink>,
) {
  const permitsPage = reviewedLinks
    .filter(({ review }) => isGeneralPermitsPage(review))
    .sort(
      (first, second) =>
        second.review.generalPermitsPage - first.review.generalPermitsPage,
    )
    .at(0)
  if (!permitsPage || !city.region || !hasDatabase()) {
    return
  }

  const region = city.region
  waitUntil(
    withDatabase((db) =>
      saveCityPermitsUrl(db, { name: city.name, region }, permitsPage.link.url),
    ).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          message: 'saving city permits page failed',
          url: permitsPage.link.url,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }),
  )
}

function buildSearchQuery(
  { city, permit }: PermitSearchInput,
  permitTypes: Array<PermitType>,
) {
  const permits =
    permitTypes.length > 0
      ? permitTypes.map(({ name }) => name).join(' ')
      : 'permit'
  return `official City of "${city.name}" "${city.region}" ${permit} ${permits} application requirements`
    .replace(/\s+/g, ' ')
    .slice(0, 400)
}

function normalizeResult(value: unknown): PermitSearchResult | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const result = value as TavilySearchResult
  if (
    typeof result.title !== 'string' ||
    typeof result.url !== 'string' ||
    typeof result.content !== 'string'
  ) {
    return null
  }

  try {
    const url = new URL(result.url)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null
    }

    const domain = url.hostname.replace(/^www\./, '')
    return {
      title: result.title,
      url: url.toString(),
      domain,
      description: result.content,
      score: typeof result.score === 'number' ? result.score : 0,
      isGovernmentSource: isGovernmentDomain(domain),
    }
  } catch {
    return null
  }
}

function matchesLocality(
  title: string,
  content: string,
  url: URL,
  { city }: PermitSearchInput,
) {
  // Only the city name is required: official pages often never name their
  // state, and Jev's jurisdiction question rejects same-named cities elsewhere.
  const cityName = normalizeText(city.name)
  const text = normalizeText(
    `${title} ${content} ${url.hostname} ${url.pathname}`,
  )
  const compactUrl = compactText(`${url.hostname}${url.pathname}`)

  return (
    includesPhrase(text, cityName) || compactUrl.includes(compactText(cityName))
  )
}

function rankResult(result: PermitSearchResult, input: PermitSearchInput) {
  const { city } = input
  const compactDomain = compactText(result.domain)
  const compactCity = compactText(city.name)
  const normalizedTitle = normalizeText(result.title)
  const searchable = normalizeText(`${result.title} ${result.url}`)
  const normalizedPermit = normalizeText(input.permit)
  const permitKeywords = normalizedPermit
    .split(' ')
    .filter((keyword) => keyword.length > 2)
  const matchingKeywords = permitKeywords.filter((keyword) =>
    includesPhrase(searchable, keyword),
  ).length
  const matchesAllKeywords =
    permitKeywords.length > 0 && matchingKeywords === permitKeywords.length
  const isPdf = result.url.toLowerCase().endsWith('.pdf')
  const cityGovernmentTitle =
    includesPhrase(normalizedTitle, `city of ${normalizeText(city.name)}`) ||
    includesPhrase(normalizedTitle, `${normalizeText(city.name)} city`)

  let rank = result.score + matchingKeywords * 400

  if (cityGovernmentTitle) {
    rank += 100
  }

  if (result.isGovernmentSource) {
    rank += 500
  }

  if (result.isGovernmentSource && compactDomain.includes(compactCity)) {
    rank += 1_000
  }

  if (matchesAllKeywords) {
    rank += 1_000
  }

  if (normalizedPermit && searchable.includes(normalizedPermit)) {
    rank += 1_500
  }

  if (isPdf) {
    rank += 1_000
  }

  if (/\b(application|apply|form)\b/.test(searchable)) {
    rank += 1_200
  }

  if (urlLooksLikeOfficialFile(result.url)) {
    rank += 500
  }

  if (/\b(handout|guide|guidelines|instructions)\b/.test(searchable)) {
    rank += 100
  }

  return rank
}

function urlLooksLikeOfficialFile(value: string) {
  try {
    const pathname = new URL(value).pathname.toLowerCase()
    return (
      pathname.includes('/files/') ||
      pathname.includes('/documents/') ||
      pathname.includes('/forms/')
    )
  } catch {
    return false
  }
}

function isLikelyHtmlPage(value: string) {
  try {
    return !/\.[a-z0-9]{2,5}$/i.test(new URL(value).pathname)
  } catch {
    return false
  }
}

function rankExtractionPage(
  result: PermitSearchResult,
  input: PermitSearchInput,
) {
  const title = normalizeText(result.title)
  const searchable = normalizeText(
    `${result.title} ${result.description} ${result.url}`,
  )
  const permitKeywords = normalizeText(input.permit)
    .split(' ')
    .filter((keyword) => keyword.length > 2)
  const matchingKeywords = permitKeywords.filter((keyword) =>
    includesPhrase(searchable, keyword),
  ).length
  let rank = rankResult(result, input) + matchingKeywords * 100

  if (title === 'permits' || title === 'permit') {
    rank += 2_000
  } else if (includesPhrase(title, 'permits')) {
    rank += 500
  }

  return rank
}

function isGovernmentDomain(domain: string) {
  return (
    domain.endsWith('.gov') ||
    domain.includes('.gov.') ||
    domain.endsWith('.us')
  )
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compactText(value: string) {
  return normalizeText(value).replace(/\s/g, '')
}

function includesPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `)
}

function deduplicateResults(results: Array<PermitSearchResult>) {
  const urls = new Set<string>()

  return results.filter((result) => {
    const normalizedUrl = result.url.replace(/\/$/, '')
    if (urls.has(normalizedUrl)) {
      return false
    }

    urls.add(normalizedUrl)
    return true
  })
}
