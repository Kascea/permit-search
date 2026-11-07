import { z } from 'zod'

import { UserError } from '#/lib/errors'

// Which copy of a form the editor opens. The city's link is the source: a form
// the city stops posting shouldn't quietly keep being filled out. A stored copy
// only stands in for work already started, which is tied to the version it was
// filled against. See docs/ux-redesign-plan.md, "Keeping saved forms current".

export interface OpenedForm {
  bytes: ArrayBuffer
  // A newer version the city has posted, for the draft to update to.
  newerVersion?: NewerVersion
  // What the user should know about this copy.
  notice?: string
}

export interface NewerVersion {
  bytes: ArrayBuffer
  hash: string
}

const REPLACED_NOTICE =
  'This form has changed since your draft was saved. Check your entries before downloading.'

const GONE_NOTICE =
  'The city no longer posts this form at this link, so this is your saved copy. Check with the city before you file it.'

const UNCHECKED_NOTICE =
  'The city’s website couldn’t be reached, so this is your saved copy. It may not be the newest version.'

// draftHash: the version the draft was filled against, if there's a draft.
// isFiled: the form has gone to the city, so it's a record of what was filed.
export async function openForm(
  url: string,
  draftHash: string | undefined,
  isFiled: boolean,
): Promise<OpenedForm> {
  if (isFiled && draftHash) {
    const filed = await fetchStoredPdf(draftHash)

    if (filed) return { bytes: filed }
  }

  const city = await fetchCityPdf(url)

  if (!draftHash) {
    if (city.kind !== 'found') throw new UserError(city.message)

    return { bytes: city.bytes }
  }

  if (city.kind === 'found' && city.hash === draftHash) {
    return { bytes: city.bytes }
  }

  const stored = await fetchStoredPdf(draftHash)

  if (!stored) {
    // The draft's version was never kept. Its answers go on what the city has
    // now, or there's nothing to open.
    if (city.kind !== 'found') throw new UserError(city.message)

    return { bytes: city.bytes, notice: REPLACED_NOTICE }
  }

  if (city.kind === 'found') {
    return {
      bytes: stored,
      newerVersion: { bytes: city.bytes, hash: city.hash },
    }
  }

  return {
    bytes: stored,
    notice: city.kind === 'gone' ? GONE_NOTICE : UNCHECKED_NOTICE,
  }
}

type CityPdf =
  | { kind: 'found'; bytes: ArrayBuffer; hash: string }
  // The city says the file isn't there: 'gone'. Anything else, such as a
  // timeout or a blocked request, says nothing about the form: 'unavailable'.
  | { kind: 'gone' | 'unavailable'; message: string }

// The PDF proxy's error response.
const pdfErrorSchema = z.object({ error: z.string() })

async function fetchCityPdf(url: string): Promise<CityPdf> {
  const response = await fetch(
    `/api/pdf?url=${encodeURIComponent(url)}`,
  ).catch(() => null)

  if (!response) {
    return { kind: 'unavailable', message: 'The PDF could not be opened.' }
  }

  if (!response.ok) {
    const payload = pdfErrorSchema.safeParse(
      await response.json().catch(() => null),
    )

    return {
      kind: response.status === 404 ? 'gone' : 'unavailable',
      message:
        (payload.success && payload.data.error) ||
        'The PDF could not be opened.',
    }
  }

  const bytes = await response.arrayBuffer()

  return { kind: 'found', bytes, hash: await sha256Hex(bytes) }
}

// Null when this version wasn't kept, or can't be read right now.
async function fetchStoredPdf(sourceHash: string) {
  const response = await fetch(`/api/pdf?hash=${sourceHash}`).catch(() => null)

  return response?.ok ? response.arrayBuffer() : null
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
