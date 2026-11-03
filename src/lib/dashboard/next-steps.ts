import type { DraftSummary } from '#/lib/drafts/types'
import type { Project, ProjectItem } from '#/lib/projects/types'

// The one thing a project needs next, in the order the dashboard asks for
// them: an address, then a permit, then each form started, then filled.
// Checking forms (phase 6 of docs/ux-redesign-plan.md) adds "fix" and "ready".
export type NextStep =
  | { kind: 'add-address' }
  | { kind: 'find-permit' }
  | { kind: 'start-form'; item: ProjectItem }
  | { kind: 'continue-form'; item: ProjectItem; draft: DraftSummary }

export interface ProjectProgress {
  project: Project
  // How many of the project's forms have a draft.
  startedCount: number
  next: NextStep
}

// Drafts by the PDF they fill. Drafts are unique per user and source URL.
export function draftsByUrl(drafts: Array<DraftSummary>) {
  return new Map(drafts.map((draft) => [draft.sourceUrl, draft]))
}

export function projectProgress(
  project: Project,
  drafts: Map<string, DraftSummary>,
): ProjectProgress {
  const started = project.items.flatMap((item) => {
    const draft = drafts.get(item.sourceUrl)

    return draft ? [{ item, draft }] : []
  })

  return {
    project,
    startedCount: started.length,
    next: nextStep(project, drafts, started),
  }
}

function nextStep(
  project: Project,
  drafts: Map<string, DraftSummary>,
  started: Array<{ item: ProjectItem; draft: DraftSummary }>,
): NextStep {
  if (!project.details.streetAddress) return { kind: 'add-address' }

  if (project.items.length === 0) return { kind: 'find-permit' }

  const unstarted = project.items.find((item) => !drafts.has(item.sourceUrl))

  if (unstarted) return { kind: 'start-form', item: unstarted }

  // Every form has a draft; continue the most recently edited one.
  let latest = started[0]

  for (const entry of started) {
    if (entry.draft.updatedAt > latest.draft.updatedAt) latest = entry
  }

  return { kind: 'continue-form', ...latest }
}

// Drafts whose PDF isn't in any of the user's projects, newest first.
export function loneDrafts(
  drafts: Array<DraftSummary>,
  projects: Array<Project>,
) {
  const inProjects = new Set(
    projects.flatMap((project) => project.items.map((item) => item.sourceUrl)),
  )

  return drafts.filter((draft) => !inProjects.has(draft.sourceUrl))
}

// The first project holding a PDF, if any.
export function projectHolding(sourceUrl: string, projects: Array<Project>) {
  return projects.find((project) =>
    project.items.some((item) => item.sourceUrl === sourceUrl),
  )
}
