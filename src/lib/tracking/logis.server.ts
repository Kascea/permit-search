import { logisEpermits } from '#/lib/tracking/logis'
import type { Jurisdiction } from '#/lib/tracking/providers'
import { PermitCheckError } from '#/lib/tracking/fetcher.server'
import type { PermitStatusFetcher } from '#/lib/tracking/fetcher.server'
import type { PermitStatus } from '#/lib/tracking/types'

// Reads a permit's public details page on epermits.logis.org, such as
// permits/permitdetails.aspx?city=sl&permitnbr=SL306008. The page has no
// status field, so the phase is worked out from its dates.

const USER_AGENT =
  'PermitSearch/1.0 (+https://permitsearch.app; permit status for the permit holder)'

// Every value on the page is a label and field pair:
// <div class="detail-label">Applied Date:</div><div class="detail-field">3/17/2021</div>
// Plain string matching, not HTMLRewriter, so the parser also runs in Node
// against saved pages.
const DETAIL_ROW =
  /<div class="detail-label">([^<]*)<\/div>\s*<div class="detail-field">([^<]*)<\/div>/g

const ENTITIES = new Map([
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&nbsp;', ' '],
])

function decode(text: string) {
  return text
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES.get(entity) ?? entity)
    .trim()
}

// "Applied Date:" → "applied date". The page lists some labels twice (both
// fee sections have "Total Fees:"), so values are kept in order.
function readDetails(html: string) {
  const details = new Map<string, Array<string>>()

  for (const [, label = '', field = ''] of html.matchAll(DETAIL_ROW)) {
    const key = decode(label).replace(/:$/, '').toLowerCase()

    details.set(key, [...(details.get(key) ?? []), decode(field)])
  }

  return details
}

// "3/17/2021" → "2021-03-17"; null when blank or not a date.
function isoDate(text: string | null) {
  const match = text?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (!match) return null

  const [, month = '', day = '', year = ''] = match

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// "$1,085.87" → 108587; null when blank or not money.
function cents(text: string) {
  const match = text.match(/^-?\$?([\d,]+)(?:\.(\d{2}))?$/)

  if (!match) return null

  const [, dollars = '0', fraction = '00'] = match

  return Number(dollars.replace(/,/g, '')) * 100 + Number(fraction)
}

// The first rule that matches wins; see "Working out the phase" in
// docs/permit-tracking-plan.md.
function phaseFor(
  dates: PermitStatus['dates'],
  balanceDueCents: number | null,
  today: string,
): Pick<PermitStatus, 'phase' | 'label'> {
  if (dates.cancelled) return { phase: 'cancelled', label: 'Cancelled' }

  if (dates.finaled) return { phase: 'finaled', label: 'Finaled' }

  if (dates.expires && dates.expires < today) {
    return { phase: 'expired', label: 'Expired' }
  }

  if (dates.issued) return { phase: 'issued', label: 'Issued' }

  if (dates.approved) {
    return balanceDueCents
      ? { phase: 'approved', label: 'Approved, fees due' }
      : { phase: 'approved', label: 'Approved' }
  }

  if (dates.applied) return { phase: 'applied', label: 'In review' }

  return { phase: 'unknown', label: 'Status unknown' }
}

// Throws a PermitCheckError when the page says the permit doesn't exist or
// doesn't look like a permit page. `today` is an ISO date, for expiry.
export function parseLogisPermitPage(
  html: string,
  permitNumber: string,
  today: string,
): PermitStatus {
  if (/could not be found/i.test(html)) {
    throw new PermitCheckError(
      `ePermits has no permit ${permitNumber}. Check the number and city.`,
    )
  }

  const details = readDetails(html)
  const first = (label: string) => details.get(label)?.[0] || null

  if (!details.has('applied date') || first('permit #') !== permitNumber) {
    throw new PermitCheckError(
      'Couldn’t read the status from ePermits right now.',
      { portalChanged: true },
    )
  }

  // Application and permit fees each have their own balance.
  const balances = (details.get('outstanding balance') ?? [])
    .map(cents)
    .filter((amount) => amount !== null)

  const balanceDueCents = balances.length
    ? balances.reduce((sum, amount) => sum + amount, 0)
    : null

  const dates: PermitStatus['dates'] = {
    applied: isoDate(first('applied date')),
    approved: isoDate(first('approved date')),
    issued: isoDate(first('issued date')),
    finaled: isoDate(first('final date')),
    // A "dead" application was closed without a permit; read as cancelled.
    cancelled: isoDate(first('cancel date') ?? first('dead date')),
    expires: isoDate(first('expiration date')),
  }

  return {
    ...phaseFor(dates, balanceDueCents, today),
    permitType:
      [first('permit type'), first('sub type')].filter(Boolean).join(' · ') ||
      null,
    description: first('description'),
    dates,
    balanceDueCents,
  }
}

export const logisStatusFetcher: PermitStatusFetcher = {
  async fetchStatus(jurisdiction: Jurisdiction, permitNumber: string) {
    const response = await fetch(
      logisEpermits.permitUrl(jurisdiction, permitNumber),
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      },
    )

    if (!response.ok) {
      throw new PermitCheckError('ePermits isn’t responding right now.')
    }

    return parseLogisPermitPage(
      await response.text(),
      permitNumber,
      new Date().toISOString().slice(0, 10),
    )
  },
}
