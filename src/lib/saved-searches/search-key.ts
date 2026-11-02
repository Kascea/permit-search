import { cityKey } from '#/lib/contacts/types'

// Bump when the search flow changes (questions, permit types, ranking) so
// saved results from the old flow aren't reused for new searches. Saved links
// still show what they showed before.
export const SEARCH_PIPELINE_VERSION = 1

// A matching search within this window reuses the saved result.
export const SEARCH_REUSE_DAYS = 7

// "Search again" runs a search fresh at most this often; inside the window it
// reuses the latest result, so repeat clicks don't each cost a search.
export const SEARCH_REFRESH_HOURS = 24

const PUBLIC_ID_LENGTH = 12
const PUBLIC_ID_ALPHABET =
  'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Words that don't change what's being searched for.
const FILLER_WORDS = new Set([
  'a',
  'an',
  'the',
  'my',
  'our',
  'i',
  'need',
  'want',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'and',
  'permit',
  'permits',
])

// Lowercase, accents, punctuation, filler words, and simple plurals removed:
// "A fence permit", "fences", and "Fence!" all become "fence".
export function normalizeQuery(permit: string) {
  const words = permit
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && !FILLER_WORDS.has(word))
    .map(singularize)

  // A query of only filler words ("permit") keeps its words.
  return words.length > 0
    ? words.join(' ')
    : permit
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function singularize(word: string) {
  if (word.length > 4 && word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`
  }
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1)
  }
  return word
}

// Two searches reuse each other only when this matches exactly.
export function searchKey(name: string, region: string, permit: string) {
  return `${cityKey(name, region)}|${normalizeQuery(permit)}|v${SEARCH_PIPELINE_VERSION}`
}

// Random and URL-safe, without look-alike characters (0/O, 1/l/I).
export function newPublicId() {
  const bytes = crypto.getRandomValues(new Uint8Array(PUBLIC_ID_LENGTH))
  return Array.from(
    bytes,
    (byte) => PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length],
  ).join('')
}
