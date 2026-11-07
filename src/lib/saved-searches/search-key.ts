import { stateCode } from '#/lib/location/states'

// Bump when the search flow changes (questions, permit types, ranking) so
// saved results from the old flow aren't reused for new searches. Saved links
// still show what they showed before.
// 4: online permit types from the city's portal, where it has one.
// 5: St. Louis Park's online permits were saved with the portal's home page
//    as their apply link.
// 6: state agency pages can appear, and the web search's query leaves out
//    request phrases such as "I need a permit for".
export const SEARCH_PIPELINE_VERSION = 6

// A matching search within this window reuses the saved result.
export const SEARCH_REUSE_DAYS = 7

// "Search again" runs a search fresh at most this often; inside the window it
// reuses the latest result, so repeat clicks don't each cost a search.
export const SEARCH_REFRESH_HOURS = 24

const PUBLIC_ID_LENGTH = 12

const PUBLIC_ID_ALPHABET =
  'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Lowercase, with accents removed and everything else between letters and
// numbers turned into one hyphen: "Replace Café Sign!" is "replace-cafe-sign".
function slugPart(value: string) {
  return withoutAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function withoutAccents(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '')
}

// "edina-mn". A region that isn't a state keeps its whole name.
function citySlug(name: string, region: string) {
  return `${slugPart(name)}-${stateCode(region) ?? slugPart(region)}`
}

// The project without how it was asked: "I need a permit for a fence" is
// "fence". For the address and the web search's query; Jev gets the whole
// wording.
export function withoutRequestPhrase(permit: string) {
  const project = permit
    .replace(
      /^(?:(?:do )?(?:i|we) )?(?:need |want )?(?:to )?(?:get )?(?:an? )?(?:permits? )?(?:to |for )?(?:an? |the |my )?/i,
      '',
    )
    .trim()

  return project || permit
}

// How it was asked and a trailing "permit" are left out, since every search is
// for a permit, and every other word stays: "I need a new fence" is "new-fence",
// while "roof and deck" and "roof deck" stay different searches. Searches with
// the same address share results. Letters a URL slug can't hold, such as
// Chinese, are kept apart by a short code of the wording.
function querySlug(permit: string) {
  const slug =
    slugPart(withoutRequestPhrase(permit)).replace(/-permits?$/, '') ||
    slugPart(permit)

  const hasOtherLetters = /[\p{L}\p{N}]/u.test(
    withoutAccents(permit).replace(/[a-zA-Z0-9]/g, ''),
  )

  if (!hasOtherLetters && slug) return slug

  const code = wordingCode(permit)

  return slug ? `${slug}-${code}` : code
}

// FNV-1a: short and the same on every run. It only separates wordings that
// would otherwise look alike, so it needn't be secure.
function wordingCode(permit: string) {
  let hash = 0x811c9dc5

  for (const char of permit.trim().toLowerCase().normalize('NFC')) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

// What a search's address looks like, for checking one from the browser.
export function isSearchSlug(value: string) {
  return value.length <= 500 && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(value)
}

// A search's address under /results: "edina-mn/a-fence-permit".
export function searchSlug(name: string, region: string, permit: string) {
  return `${citySlug(name, region)}/${querySlug(permit)}`
}

// The wording part of a search's address, stored as normalized_query.
export function normalizedQuery(permit: string) {
  return querySlug(permit)
}

// Two searches reuse each other only when this matches exactly.
export function searchKey(slug: string) {
  return `${slug}|v${SEARCH_PIPELINE_VERSION}`
}

// Whether search engines should list a search's page. Repeat searches only, so
// one person's search stays out; short and without digits, which keeps out most
// addresses and other personal details typed into the box.
export function isIndexableSearch(search: {
  permit: string
  resultCount: number
  isGeneralFallback: boolean
  timesServed: number
}) {
  return (
    search.resultCount > 0 &&
    !search.isGeneralFallback &&
    search.timesServed >= 2 &&
    search.permit.length <= 60 &&
    !/\d/.test(search.permit)
  )
}

// Random and URL-safe, without look-alike characters (0/O, 1/l/I).
export function newPublicId() {
  const bytes = crypto.getRandomValues(new Uint8Array(PUBLIC_ID_LENGTH))

  return Array.from(
    bytes,
    (byte) => PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length],
  ).join('')
}
