import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'

import type { Database } from '#/lib/db/client.server'
import { blankPdfs } from '#/lib/db/schema'
import { UserError } from '#/lib/errors'
import { fetchPdfBytes } from '#/lib/pdf/fetch-pdf.server'

const SOURCE_HASH = /^[0-9a-f]{64}$/

export function isSourceHash(value: string) {
  return SOURCE_HASH.test(value)
}

function blankPdfKey(sourceHash: string) {
  return `blank/${sourceHash}.pdf`
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

// Stores a blank form's bytes once per version and returns its hash. A
// version already stored is only looked up. The bucket is written before the
// row, so a row always has its bytes.
export async function storeBlankPdf(db: Database, bytes: ArrayBuffer) {
  const sourceHash = await sha256Hex(bytes)

  const [existing] = await db
    .select({ sourceHash: blankPdfs.sourceHash })
    .from(blankPdfs)
    .where(eq(blankPdfs.sourceHash, sourceHash))

  if (existing) return sourceHash

  const details = await readPdfDetails(bytes)

  await env.BLANK_PDFS.put(blankPdfKey(sourceHash), bytes, {
    httpMetadata: { contentType: 'application/pdf' },
  })

  await db
    .insert(blankPdfs)
    .values({ sourceHash, byteSize: bytes.byteLength, ...details })
    .onConflictDoNothing()

  return sourceHash
}

// Keeps the version a user's draft is filled against, once they've started one:
// it's needed to open their work after the city changes or removes the form.
// Read from the city rather than taken from the browser, as stored copies are
// shared. If the city has already moved on, there's nothing to keep.
export async function keepBlankCopy(
  db: Database,
  sourceUrl: string,
  sourceHash: string,
) {
  const [existing] = await db
    .select({ sourceHash: blankPdfs.sourceHash })
    .from(blankPdfs)
    .where(eq(blankPdfs.sourceHash, sourceHash))

  if (existing) return

  const bytes = await fetchPdfBytes(sourceUrl)

  if ((await sha256Hex(bytes)) === sourceHash) await storeBlankPdf(db, bytes)
}

// The stored bytes, or null when there are none for this hash.
export async function readBlankPdf(sourceHash: string) {
  if (!isSourceHash(sourceHash)) return null

  const object = await env.BLANK_PDFS.get(blankPdfKey(sourceHash))

  return object ? object.arrayBuffer() : null
}

async function readPdfDetails(bytes: ArrayBuffer) {
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    })

    // Hand-made PDFs can carry dates that don't parse.
    const modifiedAt = document.getModificationDate()

    return {
      pageCount: document.getPageCount(),
      fieldCount: document.getForm().getFields().length,
      pdfModifiedAt:
        modifiedAt && !Number.isNaN(modifiedAt.getTime()) ? modifiedAt : null,
    }
  } catch {
    throw new UserError('This PDF couldn’t be read.')
  }
}
