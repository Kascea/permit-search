import { env } from 'cloudflare:workers'

import type {
  PermitSearchInput,
  PermitSearchResponse,
  PermitSearchResult,
} from '#/lib/search/types'
import { reviewPermitLinks } from '#/lib/search/link-review.server'
import { extractRelevantOfficialLinks } from '#/lib/search/official-links.server'

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const SEARCH_TIMEOUT_MS = 15_000
const MAX_RESULTS = 10
const MAX_OFFICIAL_PAGES_TO_EXTRACT = 4

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'al',
  alaska: 'ak',
  arizona: 'az',
  arkansas: 'ar',
  california: 'ca',
  colorado: 'co',
  connecticut: 'ct',
  delaware: 'de',
  florida: 'fl',
  georgia: 'ga',
  hawaii: 'hi',
  idaho: 'id',
  illinois: 'il',
  indiana: 'in',
  iowa: 'ia',
  kansas: 'ks',
  kentucky: 'ky',
  louisiana: 'la',
  maine: 'me',
  maryland: 'md',
  massachusetts: 'ma',
  michigan: 'mi',
  minnesota: 'mn',
  mississippi: 'ms',
  missouri: 'mo',
  montana: 'mt',
  nebraska: 'ne',
  nevada: 'nv',
  'new hampshire': 'nh',
  'new jersey': 'nj',
  'new mexico': 'nm',
  'new york': 'ny',
  'north carolina': 'nc',
  'north dakota': 'nd',
  ohio: 'oh',
  oklahoma: 'ok',
  oregon: 'or',
  pennsylvania: 'pa',
  'rhode island': 'ri',
  'south carolina': 'sc',
  'south dakota': 'sd',
  tennessee: 'tn',
  texas: 'tx',
  utah: 'ut',
  vermont: 'vt',
  virginia: 'va',
  washington: 'wa',
  'west virginia': 'wv',
  wisconsin: 'wi',
  wyoming: 'wy',
  'district of columbia': 'dc',
}

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
  const query = buildSearchQuery(input)
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
    const results = Array.isArray(payload.results)
      ? payload.results
          .map((result) => normalizeResult(result, input))
          .filter((result): result is PermitSearchResult => result !== null)
      : []
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
        links: await extractRelevantOfficialLinks(page, input),
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
    )
    const rankedResults = reviewedLinks
      .sort(
        (first, second) =>
          second.confidentMatches - first.confidentMatches ||
          rankResult(second.link, input) - rankResult(first.link, input),
      )
      .slice(0, MAX_RESULTS)
      .map(({ link }) => link)
    return {
      query: typeof payload.query === 'string' ? payload.query : query,
      results: rankedResults,
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

function buildSearchQuery({ city, permit }: PermitSearchInput) {
  return `official City of "${city.name}" "${city.region}" ${permit} permit application requirements`
    .replace(/\s+/g, ' ')
    .slice(0, 400)
}

function normalizeResult(
  value: unknown,
  input: PermitSearchInput,
): PermitSearchResult | null {
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
    if (!matchesLocality(result.title, result.content, url, input)) {
      return null
    }

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
  if (typeof city.region !== 'string') {
    return false
  }

  const cityName = normalizeText(city.name)
  const region = normalizeText(city.region)
  const stateAbbreviation = US_STATE_ABBREVIATIONS[region]
  const text = normalizeText(
    `${title} ${content} ${url.hostname} ${url.pathname}`,
  )
  const compactUrl = compactText(`${url.hostname}${url.pathname}`)
  const cityMatches =
    includesPhrase(text, cityName) || compactUrl.includes(compactText(cityName))
  const regionMatches =
    includesPhrase(text, region) ||
    (stateAbbreviation
      ? includesPhrase(text, stateAbbreviation) ||
        compactUrl.includes(`${compactText(cityName)}${stateAbbreviation}`)
      : false)

  return cityMatches && regionMatches
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
