import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { parseUserInput } from '#/lib/errors'
import {
  listPermitProjects,
  listSavedPermits,
  removeSavedPermit,
  savePermit,
  updateSavedPermit,
} from '#/lib/permits/permits.server'
import {
  savePermitSchema,
  savedPermitIdSchema,
  updateSavedPermitSchema,
} from '#/lib/permits/types'
import { rateLimited } from '#/lib/rate-limit'

// Saved permits belong to the signed-in user; the browser never sends a user
// ID, and a permit that isn't theirs reads as missing.

const permitIdInput = parseUserInput(z.object({ publicId: savedPermitIdSchema }))

// Null when signed out, so pages can ask the visitor to sign in.
export const listAccountPermits = createServerFn({ method: 'GET' }).handler(
  () =>
    withUserDatabase(
      new Headers(getRequestHeaders()),
      (userId, db) => listSavedPermits(db, userId),
      () => null,
    ),
)

// Null when signed out; the permit is null when it isn't the user's.
export const getAccountPermit = createServerFn({ method: 'GET' })
  .validator(permitIdInput)
  .handler(({ data }) =>
    withUserDatabase(
      new Headers(getRequestHeaders()),
      async (userId, db) => {
        const [permit] = await listSavedPermits(db, userId, data.publicId)

        if (!permit) return { permit: null, projects: [] }

        return {
          permit,
          projects: await listPermitProjects(db, userId, permit.sourceUrl),
        }
      },
      () => null,
    ),
  )

// Downloads the form, so it's limited like the PDF proxy. Saving a link
// that's already saved returns the existing permit.
export const saveAccountPermit = createServerFn({ method: 'POST' })
  .middleware([rateLimited])
  .validator(parseUserInput(savePermitSchema))
  .handler(({ data }) =>
    withUserDatabase(new Headers(getRequestHeaders()), async (userId, db) => {
      const publicId = await savePermit(db, userId, data)
      const [permit] = await listSavedPermits(db, userId, publicId)

      return permit
    }),
  )

export const updateAccountPermit = createServerFn({ method: 'POST' })
  .validator(parseUserInput(updateSavedPermitSchema))
  .handler(({ data: { publicId, ...changes } }) =>
    withUserDatabase(new Headers(getRequestHeaders()), async (userId, db) => {
      await updateSavedPermit(db, userId, publicId, changes)
      const [permit] = await listSavedPermits(db, userId, publicId)

      return permit ?? null
    }),
  )

// Returns the library. Projects holding the form's link keep it.
export const removeAccountPermit = createServerFn({ method: 'POST' })
  .validator(permitIdInput)
  .handler(({ data }) =>
    withUserDatabase(new Headers(getRequestHeaders()), async (userId, db) => {
      await removeSavedPermit(db, userId, data.publicId)

      return listSavedPermits(db, userId)
    }),
  )
