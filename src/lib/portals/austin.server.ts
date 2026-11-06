import { z } from 'zod'

import { AUSTIN_USER_AGENT } from '#/lib/portals/austin'
import { PermitCheckError } from '#/lib/portals/fetcher.server'
import type { PermitStatusFetcher } from '#/lib/portals/fetcher.server'
import type { PermitPhase, PermitStatus } from '#/lib/portals/types'

// Reads a permit's status from Austin's open data, updated daily. Numbers
// ending in PR are plan review cases, which are listed from the day they're
// filed. Every other permit is in "Issued Construction Permits", so a trade or
// building permit isn't listed until it's issued. Neither dataset has fees.

const DATASET_URL = 'https://data.austintexas.gov/resource/3syk-w9eu.json'

const PLAN_REVIEW_DATASET_URL =
  'https://data.austintexas.gov/resource/n8ck-xkda.json'

// A permit as either dataset describes it.
export interface PermitRow {
  permitType?: string
  workClass?: string
  description?: string
  status?: string
  statusDate?: string
  applied?: string
  issued?: string
  finaled?: string
  expires?: string
  link?: string
}

const linkSchema = z.object({ url: z.string() }).optional()

// Only what a status needs, in $select. Both datasets also have people's names
// and phone numbers, which we have no use for.
const ISSUED_PERMITS = {
  url: DATASET_URL,
  select:
    'permit_type_desc,work_class,description,status_current,statusdate,applieddate,issue_date,completed_date,expiresdate,link',
  rows: z.array(
    z
      .object({
        permit_type_desc: z.string().optional(),
        work_class: z.string().optional(),
        description: z.string().optional(),
        status_current: z.string().optional(),
        statusdate: z.string().optional(),
        applieddate: z.string().optional(),
        issue_date: z.string().optional(),
        completed_date: z.string().optional(),
        expiresdate: z.string().optional(),
        link: linkSchema,
      })
      .transform(
        (row): PermitRow => ({
          permitType: row.permit_type_desc,
          workClass: row.work_class,
          description: row.description,
          status: row.status_current,
          statusDate: row.statusdate,
          applied: row.applieddate,
          issued: row.issue_date,
          finaled: row.completed_date,
          expires: row.expiresdate,
          link: row.link?.url,
        }),
      ),
  ),
}

// Its issued_date and final_date are left out: they say when the review
// closed, however it ended, not when a permit was issued or finished.
const PLAN_REVIEW_CASES = {
  url: PLAN_REVIEW_DATASET_URL,
  select:
    'permit_type,work_class,folder_description,status_current,status_date,applied_date,expires_date,web_link',
  rows: z.array(
    z
      .object({
        permit_type: z.string().optional(),
        work_class: z.string().optional(),
        folder_description: z.string().optional(),
        status_current: z.string().optional(),
        status_date: z.string().optional(),
        applied_date: z.string().optional(),
        expires_date: z.string().optional(),
        web_link: linkSchema,
      })
      .transform(
        (row): PermitRow => ({
          permitType: row.permit_type,
          workClass: row.work_class,
          description: row.folder_description,
          status: row.status_current,
          statusDate: row.status_date,
          applied: row.applied_date,
          expires: row.expires_date,
          link: row.web_link?.url,
        }),
      ),
  ),
}

// The datasets' status_current values, in lower case. A status not listed,
// such as "On Hold" or "Suspended", keeps the city's wording as 'unknown'.
const STATUS_PHASES = new Map<string, PermitPhase>([
  ['active', 'issued'],
  ['final', 'finaled'],
  ['approved', 'approved'],
  ['approved and released', 'approved'],
  ['revision approved', 'approved'],
  ['in review', 'applied'],
  ['in e-review', 'applied'],
  ['queue', 'applied'],
  ['intake pending', 'applied'],
  ['e-prerequisite review pending', 'applied'],
  ['prerequisite review approved', 'applied'],
  ['awaiting update', 'applied'],
  ['awaiting update - fee paid', 'applied'],
  ['awaiting update - fees due', 'applied'],
  ['new application required', 'cancelled'],
  ['intake rejected', 'cancelled'],
  ['expired', 'expired'],
  ['expired - license', 'expired'],
  ['void', 'cancelled'],
  ['withdrawn', 'cancelled'],
  ['cancelled', 'cancelled'],
  ['cancelled - contractor required', 'cancelled'],
  ['cancelled - new permit required', 'cancelled'],
  ['new permit required', 'cancelled'],
  ['aborted', 'cancelled'],
  ['denied but closed', 'cancelled'],
  ['revoked', 'cancelled'],
  ['rejected', 'cancelled'],
  ['pending', 'applied'],
  ['pending permit', 'applied'],
  ['re review', 'applied'],
  ['application incomplete', 'applied'],
  ['awaiting upload', 'applied'],
])

// Where the city's word isn't what we'd say to a person.
const STATUS_LABELS = new Map([
  ['active', 'Issued'],
  ['final', 'Finaled'],
  ['void', 'Void'],
])

// "2026-11-04T00:00:00.000" → "2026-11-04"; null when missing.
function isoDate(text: string | undefined) {
  return text?.slice(0, 10) || null
}

export function permitStatusFromRow(row: PermitRow): PermitStatus {
  const cityStatus = row.status?.trim() ?? ''
  const key = cityStatus.toLowerCase()
  const phase = STATUS_PHASES.get(key) ?? 'unknown'

  return {
    phase,
    label: STATUS_LABELS.get(key) ?? (cityStatus || 'Status unknown'),
    permitType: [row.permitType, row.workClass].filter(Boolean).join(' · ') || null,
    description: row.description?.trim() || null,
    dates: {
      applied: isoDate(row.applied),
      approved: phase === 'approved' ? isoDate(row.statusDate) : null,
      issued: isoDate(row.issued),
      finaled: phase === 'finaled' ? isoDate(row.finaled ?? row.statusDate) : null,
      cancelled: phase === 'cancelled' ? isoDate(row.statusDate) : null,
      expires: isoDate(row.expires),
    },
    balanceDueCents: null,
    // Goes in an href, so only a web link is kept.
    ...(row.link?.startsWith('https://') && { permitUrl: row.link }),
  }
}

export const austinStatusFetcher: PermitStatusFetcher = {
  async fetchStatus(_jurisdiction, permitNumber) {
    const dataset = permitNumber.endsWith(' PR')
      ? PLAN_REVIEW_CASES
      : ISSUED_PERMITS

    const params = new URLSearchParams({
      permit_number: permitNumber,
      $select: dataset.select,
      $limit: '1',
    })

    const response = await fetch(`${dataset.url}?${params}`, {
      headers: { 'User-Agent': AUSTIN_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new PermitCheckError('Austin’s open data isn’t responding right now.')
    }

    const rows = dataset.rows.safeParse(await response.json())

    if (!rows.success) {
      throw new PermitCheckError(
        'Couldn’t read the status from Austin’s open data right now.',
        { portalChanged: true },
      )
    }

    const [row] = rows.data

    if (!row) {
      throw new PermitCheckError(
        `Austin’s open data doesn’t list ${permitNumber}. Check the number. Building, electrical, mechanical, plumbing and driveway permits are listed once they’re issued, and plan review cases (ending in PR) within a day or so of filing. Until then, look it up on the city’s public search.`,
      )
    }

    return permitStatusFromRow(row)
  },
}
