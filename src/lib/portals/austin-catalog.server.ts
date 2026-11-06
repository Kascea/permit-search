import {
  AUSTIN_TYPES_OF_PERMITS_URL,
  AUSTIN_USER_AGENT,
} from '#/lib/portals/austin'
import { PermitCheckError } from '#/lib/portals/fetcher.server'
import type {
  CatalogPermitType,
  PortalCatalogReader,
} from '#/lib/portals/fetcher.server'
import { decodeHtmlText, htmlLinks, htmlToLines } from '#/lib/portals/html'
import type { PermitRequirements } from '#/lib/portals/types'

// Reads Austin's permits from its public Types of Permits page, since AB+C
// lists them only after signing in. The page groups tables in a <dl>:
// <dt>Residential Building and Trade Permits</dt><dd><table>…
// <tr><td>Name</td><td>Description</td><td>How to Apply</td></tr>

const SECTION = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g
const ROW = /<tr[^>]*>([\s\S]*?)<\/tr>/g
const CELL = /<td[^>]*>([\s\S]*?)<\/td>/g

function plainText(html: string) {
  return decodeHtmlText(html.replace(/<[^>]+>/g, ' '))
}

// "Pool and/or Uncovered Deck" → "pool-and-or-uncovered-deck".
function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// A permit filed by email or in person has no link here, so it isn't offered
// as an online application.
export function parseAustinPermits(
  html: string,
): Array<{ type: CatalogPermitType; requirements: PermitRequirements }> {
  // The walk-in services after the list repeat some names, as in-person ones.
  const list = html.slice(html.indexOf('<dl'), html.indexOf('</dl>'))

  const permits = new Map<
    string,
    { type: CatalogPermitType; requirements: PermitRequirements }
  >()

  for (const [, rawSection = '', sectionBody = ''] of list.matchAll(SECTION)) {
    const category = plainText(rawSection)

    for (const [, row = ''] of sectionBody.matchAll(ROW)) {
      const cells = [...row.matchAll(CELL)].map(([, cell = '']) => cell)
      const [nameCell = '', descriptionCell = '', applyCell = ''] = cells
      const name = plainText(nameCell)

      const [apply, ...otherApply] = htmlLinks(
        applyCell,
        AUSTIN_TYPES_OF_PERMITS_URL,
      )

      if (cells.length !== 3 || !name || !apply) continue

      const externalId = `${slug(category)}--${slug(name)}`

      // The page lists a few permits twice in a section; the first wins.
      if (permits.has(externalId)) continue

      // Each type needs a unique page, and many share one, so the type's ID
      // goes in the fragment. See portal_permit_types.page_url.
      const pageUrl = new URL(
        htmlLinks(nameCell, AUSTIN_TYPES_OF_PERMITS_URL)[0]?.url ??
          AUSTIN_TYPES_OF_PERMITS_URL,
      )

      pageUrl.hash = externalId

      permits.set(externalId, {
        type: {
          externalId,
          name,
          category,
          // The page says when plans aren't needed, never that they are.
          plansRequired: /does not require a formal review/i.test(
            plainText(descriptionCell),
          )
            ? false
            : null,
          pageUrl: pageUrl.toString(),
          applyUrl: apply.url,
          feeEstimatorUrl: null,
          details: {},
        },
        requirements: {
          documents: [],
          notes: htmlToLines(descriptionCell).map((line) => line.text),
          links: [
            ...htmlLinks(descriptionCell, AUSTIN_TYPES_OF_PERMITS_URL),
            ...otherApply,
          ],
          declaration: null,
        },
      })
    }
  }

  if (permits.size === 0) {
    throw new PermitCheckError(
      'Couldn’t read the permit list from Austin’s website.',
      { portalChanged: true },
    )
  }

  return [...permits.values()]
}

async function fetchPermits() {
  const response = await fetch(AUSTIN_TYPES_OF_PERMITS_URL, {
    headers: { 'User-Agent': AUSTIN_USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new PermitCheckError('Austin’s website isn’t responding right now.')
  }

  return parseAustinPermits(await response.text())
}

export const austinCatalogReader: PortalCatalogReader = {
  async listPermitTypes() {
    return (await fetchPermits()).map(({ type }) => type)
  },

  async readRequirements(_jurisdiction, externalId) {
    const permit = (await fetchPermits()).find(
      ({ type }) => type.externalId === externalId,
    )

    if (!permit) {
      throw new PermitCheckError(
        'Austin’s website no longer lists this permit.',
      )
    }

    return permit.requirements
  },
}
