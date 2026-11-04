import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { parseUserInput } from '#/lib/errors'
import { listProjects } from '#/lib/projects/projects.server'
import { limitRequest } from '#/lib/rate-limit.server'
import {
  projectSourceUrlSchema,
  publicIdSchema,
} from '#/lib/projects/types'
import { trackedPermitInputSchema } from '#/lib/tracking/providers'
import {
  checkItemPermit,
  removeItemPermit,
  setItemPermit,
} from '#/lib/tracking/tracking.server'

// A form in a project, as the project page names it.
const projectFormSchema = z.object({
  publicId: publicIdSchema(),
  sourceUrl: projectSourceUrlSchema,
})

// Each returns the user's updated projects, like the project changes do. The
// checks also return what the check found, for the page's toast.

// Saves the number and checks its status straight away, so the form shows
// where the permit stands as soon as the dialog closes. A failed check is
// stored on the permit, not thrown.
export const setProjectFormPermit = createServerFn({ method: 'POST' })
  .validator(
    parseUserInput(
      projectFormSchema.extend({ permit: trackedPermitInputSchema }),
    ),
  )
  .handler(async ({ data }) => {
    const headers = new Headers(getRequestHeaders())

    // Each check reaches the city's portal.
    await limitRequest('permit-check', headers)

    return withUserDatabase(headers, async (userId, db) => {
      await setItemPermit(db, userId, data.publicId, data.sourceUrl, data.permit)

      const check = await checkItemPermit(
        db,
        userId,
        data.publicId,
        data.sourceUrl,
      )

      return { projects: await listProjects(db, userId), check }
    })
  })

// Checks the permit's status now, unless it was checked in the last 15
// minutes.
export const checkProjectFormPermit = createServerFn({ method: 'POST' })
  .validator(parseUserInput(projectFormSchema))
  .handler(async ({ data }) => {
    const headers = new Headers(getRequestHeaders())

    await limitRequest('permit-check', headers)

    return withUserDatabase(headers, async (userId, db) => {
      const check = await checkItemPermit(
        db,
        userId,
        data.publicId,
        data.sourceUrl,
      )

      return { projects: await listProjects(db, userId), check }
    })
  })

export const removeProjectFormPermit = createServerFn({ method: 'POST' })
  .validator(parseUserInput(projectFormSchema))
  .handler(({ data }) =>
    withUserDatabase(new Headers(getRequestHeaders()), async (userId, db) => {
      await removeItemPermit(db, userId, data.publicId, data.sourceUrl)

      return listProjects(db, userId)
    }),
  )
