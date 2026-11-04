import { PermitCheckError } from '#/lib/portals/fetcher.server'
import type {
  CatalogPermitType,
  PortalCatalogReader,
} from '#/lib/portals/fetcher.server'
import { decodeHtmlText, htmlLinks, htmlToLines } from '#/lib/portals/html'
import { LOGIS_PORTAL_URL, LOGIS_USER_AGENT } from '#/lib/portals/logis'
import type { Jurisdiction } from '#/lib/portals/providers'
import type { PermitRequirements } from '#/lib/portals/types'

// Reads a LOGIS city's permit types from its public fee estimator list
// (permits/default.aspx?city=sl&estimator=true), and each type's requirements
// from permits/permitrequirements.aspx?city=sl&permitid=42.

// <h3>Building - Residential</h3><ul …><li><a href="…permitid=61">Residential - …</a></li>…</ul>
const CATEGORY = /<h3>([\s\S]*?)<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g
const TYPE_LINK = /permitid=(\d+)"[^>]*>([\s\S]*?)<\/a>/g

// Whether a category says plans are needed. "No Plan Review Required" says
// they aren't; a category that says neither is null.
export function plansRequiredFrom(category: string) {
  if (/no plan review|non-structural/i.test(category)) return false

  if (/plans? required|plan review required|requires plan review/i.test(category)) {
    return true
  }

  return null
}

function cityUrl(path: string, jurisdiction: Jurisdiction, permitId?: string) {
  const params = new URLSearchParams({ city: jurisdiction.code })

  if (permitId) params.set('permitid', permitId)

  return `${LOGIS_PORTAL_URL}/${path}?${params}`
}

export function parseLogisCatalog(
  html: string,
  jurisdiction: Jurisdiction,
): Array<CatalogPermitType> {
  const start = html.indexOf('Estimate Permit Fees')

  if (start === -1) {
    throw new PermitCheckError('Couldn’t read the permit list from ePermits.', {
      portalChanged: true,
    })
  }

  const types: Array<CatalogPermitType> = []
  const seen = new Set<string>()

  for (const [, rawCategory = '', list = ''] of html
    .slice(start)
    .matchAll(CATEGORY)) {
    const category = decodeHtmlText(rawCategory)

    for (const [, permitId = '', rawName = ''] of list.matchAll(TYPE_LINK)) {
      // A type can be listed under two categories; the first wins.
      if (seen.has(permitId)) continue
      seen.add(permitId)

      types.push({
        externalId: permitId,
        name: decodeHtmlText(rawName.replace(/<[^>]+>/g, '')),
        category: category || null,
        plansRequired: plansRequiredFrom(category),
        pageUrl: cityUrl('permits/permitrequirements.aspx', jurisdiction, permitId),
        // The same page: its "I Agree - Apply for Permit" button opens this
        // permit's application. Linking to permitapplication.aspx directly
        // sends a signed-out visitor to the sign-in page, which forgets the
        // permit.
        applyUrl: cityUrl('permits/permitrequirements.aspx', jurisdiction, permitId),
        feeEstimatorUrl: cityUrl(
          'permits/permitestimator.aspx',
          jurisdiction,
          permitId,
        ),
        details: {},
      })
    }
  }

  return types
}

// The page's own text sits in "html-editor-content", which the city writes
// freely: lists become documents, other lines notes, and links are kept.
export function parseLogisRequirements(
  html: string,
  pageUrl: string,
): PermitRequirements {
  if (!html.includes('Permit Requirements')) {
    throw new PermitCheckError(
      'Couldn’t read the permit’s requirements from ePermits.',
      { portalChanged: true },
    )
  }

  const contentStart = html.indexOf('html-editor-content')
  const declarationId = html.indexOf('boxDeclaration')
  const mainEnd = html.indexOf('</main>')

  // The declaration box's opening tag, so neither part cuts into it.
  const declarationStart =
    declarationId === -1 ? -1 : html.lastIndexOf('<', declarationId)

  const content =
    contentStart === -1
      ? ''
      : html.slice(
          html.indexOf('>', contentStart) + 1,
          declarationStart === -1 ? mainEnd : declarationStart,
        )

  const lines = htmlToLines(content)

  const declaration =
    declarationStart === -1
      ? null
      : htmlToLines(html.slice(declarationStart, mainEnd))
          .map((line) => line.text)
          // The heading, and shouted warnings such as "STOP!!!".
          .filter(
            (text) => text !== 'Owner Declaration' && text !== text.toUpperCase(),
          )
          .join(' ')
          .slice(0, 4_000) || null

  return {
    documents: lines.filter((line) => line.isListItem).map((line) => line.text),
    notes: lines.filter((line) => !line.isListItem).map((line) => line.text),
    links: htmlLinks(content, pageUrl),
    declaration,
  }
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': LOGIS_USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new PermitCheckError('ePermits isn’t responding right now.')
  }

  return response.text()
}

export const logisCatalogReader: PortalCatalogReader = {
  async listPermitTypes(jurisdiction) {
    const url = `${cityUrl('permits/default.aspx', jurisdiction)}&estimator=true`

    return parseLogisCatalog(await fetchPage(url), jurisdiction)
  },

  async readRequirements(jurisdiction, externalId) {
    const url = cityUrl(
      'permits/permitrequirements.aspx',
      jurisdiction,
      externalId,
    )

    return parseLogisRequirements(await fetchPage(url), url)
  },
}
