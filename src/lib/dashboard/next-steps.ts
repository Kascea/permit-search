import { draftKey } from '#/lib/drafts/types'
import type { DraftSummary } from '#/lib/drafts/types'
import { providerForCity } from '#/lib/portals/providers'
import type { Project, ProjectItem } from '#/lib/projects/types'

// The one thing a project needs next: an address, then a permit, then each
// form started, filled and filed, then following the permits the city issues.
// Checking forms (phase 6 of docs/ux-redesign-plan.md) adds "fix" and "ready".
export type NextStep =
  | { kind: 'add-address' }
  | { kind: 'find-permit' }
  | { kind: 'start-form'; item: ProjectItem }
  | { kind: 'apply-online'; item: ProjectItem }
  | { kind: 'continue-form'; item: ProjectItem; draft: DraftSummary }
  // Everything's filed from here on.
  | { kind: 'review-permit'; item: ProjectItem }
  | { kind: 'add-permit-number'; item: ProjectItem }
  | { kind: 'follow-permit'; item: ProjectItem }
  // Filed where the app can't see what happens next.
  | { kind: 'filed' }
  // Every permit has passed final inspection.
  | { kind: 'finished' }

export interface ProjectProgress {
  project: Project
  // How many of the project's forms have been filed with the city.
  filedCount: number
  next: NextStep
}

// A permit number means it was filed, even from before filing was recorded.
export function isFiled(item: ProjectItem) {
  return Boolean(item.filedAt ?? item.permit)
}

// Drafts by the form they fill; see draftKey.
export function draftsByForm(drafts: Array<DraftSummary>) {
  return new Map(
    drafts.map((draft) => [draftKey(draft.sourceUrl, draft.projectId), draft]),
  )
}

export function projectProgress(
  project: Project,
  drafts: Map<string, DraftSummary>,
): ProjectProgress {
  return {
    project,
    filedCount: project.items.filter(isFiled).length,
    next: nextStep(project, drafts),
  }
}

function nextStep(
  project: Project,
  drafts: Map<string, DraftSummary>,
): NextStep {
  const { items } = project

  if (items.length > 0 && items.every(isFiled)) return afterFiling(project)

  if (!project.details.streetAddress) return { kind: 'add-address' }

  if (items.length === 0) return { kind: 'find-permit' }

  const open = items.filter((item) => !isFiled(item))

  const draftOf = (item: ProjectItem) =>
    drafts.get(draftKey(item.sourceUrl, project.publicId))

  // Online applications are filed on the city's portal, so they never have a
  // draft.
  const unstarted = open.find(
    (item) => item.kind === 'online' || !draftOf(item),
  )

  if (unstarted) {
    return unstarted.kind === 'online'
      ? { kind: 'apply-online', item: unstarted }
      : { kind: 'start-form', item: unstarted }
  }

  // Every open form has a draft; continue the most recently edited one.
  const started = open.flatMap((item) => {
    const draft = draftOf(item)

    return draft ? [{ item, draft }] : []
  })

  let latest = started[0]

  for (const entry of started) {
    if (entry.draft.updatedAt > latest.draft.updatedAt) latest = entry
  }

  return { kind: 'continue-form', ...latest }
}

function afterFiling({ city, items }: Project): NextStep {
  const stopped = items.find(({ permit }) =>
    ['cancelled', 'expired'].includes(permit?.status?.phase ?? ''),
  )

  if (stopped) return { kind: 'review-permit', item: stopped }

  const untracked = items.filter(({ permit }) => !permit)

  if (untracked.length > 0 && providerForCity(city)) {
    return { kind: 'add-permit-number', item: untracked[0] }
  }

  const moving = items.find(
    ({ permit }) => permit && permit.status?.phase !== 'finaled',
  )

  if (moving) return { kind: 'follow-permit', item: moving }

  return untracked.length > 0 ? { kind: 'filed' } : { kind: 'finished' }
}

// Drafts outside a project, newest first.
export function loneDrafts(drafts: Array<DraftSummary>) {
  return drafts.filter((draft) => !draft.projectId)
}

// The draft to pick up: the newest one that isn't on a form already filed.
export function draftToContinue(
  drafts: Array<DraftSummary>,
  projects: Array<Project>,
) {
  return drafts.find((draft) => {
    const project = projects.find(
      ({ publicId }) => publicId === draft.projectId,
    )

    const item = project?.items.find(
      ({ sourceUrl }) => sourceUrl === draft.sourceUrl,
    )

    return !item || !isFiled(item)
  })
}
