import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { withUserDatabase } from '#/lib/auth/auth.server'
import { listDrafts } from '#/lib/drafts/drafts.server'
import type { DraftSummary } from '#/lib/drafts/types'
import { listProjects } from '#/lib/projects/projects.server'
import type { Project } from '#/lib/projects/types'

// Everything the dashboard works out next steps from, most recent first.
export interface Dashboard {
  projects: Array<Project>
  drafts: Array<DraftSummary>
}

// Null when signed out, so the dashboard can send the visitor to search.
// One request, so the page loads in one round trip.
export const getDashboard = createServerFn({ method: 'GET' }).handler(() =>
  withUserDatabase(
    new Headers(getRequestHeaders()),
    async (userId, db): Promise<Dashboard> => {
      // One connection, so these run one after another.
      const projects = await listProjects(db, userId)
      const drafts = await listDrafts(db, userId)

      return { projects, drafts }
    },
    () => null,
  ),
)
