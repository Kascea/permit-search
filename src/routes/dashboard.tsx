import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { AppPage } from '#/components/AppPage'
import { AddToProjectDialog } from '#/components/AddToProjectDialog'
import { EditedDate } from '#/components/EditedDate'
import { SignInGate } from '#/components/SignInGate'
import { getDashboard } from '#/lib/dashboard/dashboard'
import type { Dashboard } from '#/lib/dashboard/dashboard'
import {
  draftsByUrl,
  loneDrafts,
  projectHolding,
  projectProgress,
} from '#/lib/dashboard/next-steps'
import type { NextStep, ProjectProgress } from '#/lib/dashboard/next-steps'
import type { DraftSummary } from '#/lib/drafts/types'
import { originParam } from '#/lib/navigation/origin'
import type { Project } from '#/lib/projects/types'
import { formatProjectAddress } from '#/lib/projects/types'
import { setAccountProjects } from '#/lib/projects/use-account-projects'
import { searchPageTarget } from '#/lib/search/pending-search'

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [{ title: 'Dashboard | Permit Search' }],
  }),
  // Null when signed out.
  loader: () => getDashboard(),
  component: DashboardRoute,
})

function DashboardRoute() {
  const dashboard = Route.useLoaderData()

  if (dashboard) return <DashboardPage dashboard={dashboard} />

  return (
    <AppPage>
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        Dashboard
      </p>
      <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        What’s next
      </h1>
      <SignInGate>
        Sign in to pick up where you left off and see the next step for each of
        your projects.
      </SignInGate>
    </AppPage>
  )
}

// How many projects and loose forms show before "See all".
const PROJECT_COUNT = 8
const LONE_DRAFT_COUNT = 5

const buttonClass =
  'inline-flex shrink-0 items-center rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'

const seeAllClass =
  'shrink-0 text-sm font-medium text-blueprint underline-offset-2 hover:underline'

function DashboardPage({ dashboard }: { dashboard: Dashboard }) {
  const { projects, drafts } = dashboard
  const byUrl = draftsByUrl(drafts)
  const lone = loneDrafts(drafts, projects)
  const latest = drafts.at(0)
  // The header owns the search modal; next steps that need a search open it.
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const openSearch = () => setIsSearchOpen(true)

  return (
    <AppPage isSearchOpen={isSearchOpen} onSearchOpenChange={setIsSearchOpen}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            Dashboard
          </p>
          <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            What’s next
          </h1>
        </div>
        <Link to="/projects/new" className={buttonClass}>
          New project
        </Link>
      </div>

      {projects.length === 0 && drafts.length === 0 ? (
        <GettingStarted onSearch={openSearch} />
      ) : (
        <>
          {latest && (
            <ContinueSection
              draft={latest}
              project={projectHolding(latest.sourceUrl, projects)}
            />
          )}
          <ProjectsSection
            progress={projects.map((project) =>
              projectProgress(project, byUrl),
            )}
            onSearch={openSearch}
          />
          {lone.length > 0 && <LoneDraftsSection drafts={lone} />}
        </>
      )}
    </AppPage>
  )
}

// A titled group with an optional "See all" link.
function DashboardSection({
  label,
  seeAll,
  children,
}: {
  label: string
  seeAll?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
          {label}
        </h2>
        {seeAll}
      </div>
      {children}
    </section>
  )
}

// The form edited last, to pick up where the user left off.
function ContinueSection({
  draft,
  project,
}: {
  draft: DraftSummary
  project: Project | undefined
}) {
  return (
    <DashboardSection label="Continue">
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-b border-ink bg-paper/50 py-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg leading-6 font-medium text-ink">
            {draft.title}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink/60">
            {project ? project.name : 'Not in a project'} · Edited{' '}
            <EditedDate iso={draft.updatedAt} />
          </p>
        </div>
        <Link
          to="/editor"
          search={{
            url: draft.sourceUrl,
            project: project?.publicId,
            from: project
              ? originParam({ kind: 'project', id: project.publicId })
              : 'drafts',
          }}
          className={buttonClass}
        >
          Resume
        </Link>
      </div>
    </DashboardSection>
  )
}

// onSearch opens the header's search modal, for a next step that needs one.
function ProjectsSection({
  progress,
  onSearch,
}: {
  progress: Array<ProjectProgress>
  onSearch: () => void
}) {
  const shown = progress.slice(0, PROJECT_COUNT)

  return (
    <DashboardSection
      label="Your projects"
      seeAll={
        progress.length > shown.length && (
          <Link to="/projects" className={seeAllClass}>
            See all {progress.length}
          </Link>
        )
      }
    >
      {shown.length === 0 ? (
        <p className="mt-3 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          A project keeps the address, people and forms for one job together.{' '}
          <Link
            to="/projects/new"
            className="font-medium text-blueprint underline-offset-2 hover:underline"
          >
            Start a project
          </Link>
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/20 border-t border-b border-ink">
          {shown.map((row) => (
            <ProjectRow
              key={row.project.publicId}
              progress={row}
              onSearch={onSearch}
            />
          ))}
        </ul>
      )}
    </DashboardSection>
  )
}

function ProjectRow({
  progress,
  onSearch,
}: {
  progress: ProjectProgress
  onSearch: () => void
}) {
  const { project, startedCount, next } = progress
  const formCount = project.items.length
  const place = formatProjectAddress(project) || 'No address yet'

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
      <div className="min-w-0 flex-1">
        <Link
          to="/projects/$projectId"
          params={{ projectId: project.publicId }}
          className="block truncate font-medium text-ink hover:text-blueprint"
        >
          {project.name}
        </Link>
        <p className="mt-0.5 truncate text-sm text-ink/60">
          {place}
          {formCount > 0 &&
            ` · ${startedCount} of ${formCount} ${
              formCount === 1 ? 'form' : 'forms'
            } started`}
        </p>
        {formCount > 0 && (
          <span
            aria-hidden="true"
            className="mt-2 block h-1 max-w-48 bg-ink/10"
          >
            <span
              className="block h-full bg-blueprint"
              style={{ width: `${(startedCount / formCount) * 100}%` }}
            />
          </span>
        )}
      </div>
      <NextStepLink project={project} next={next} onSearch={onSearch} />
    </li>
  )
}

const stepLinkClass =
  'group inline-flex max-w-full items-center gap-2 rounded-full border border-ink/40 py-1.5 pr-3 pl-4 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'

// The project's next step as one action.
function NextStepLink({
  project,
  next,
  onSearch,
}: {
  project: Project
  next: NextStep
  onSearch: () => void
}) {
  const label = <span className="truncate">{stepLabel(next)}</span>

  const arrow = (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  )

  if (next.kind === 'add-address') {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.publicId }}
        className={stepLinkClass}
      >
        {label}
        {arrow}
      </Link>
    )
  }

  if (next.kind === 'find-permit') {
    const { city } = project
    const permit = project.details.workDescription || project.name

    // Runs the search straight away when the project says where and what;
    // otherwise opens the search to ask.
    return city ? (
      <Link
        {...searchPageTarget({
          city: { name: city.name, region: city.region },
          permit,
        })}
        className={stepLinkClass}
      >
        {label}
        {arrow}
      </Link>
    ) : (
      <button type="button" className={stepLinkClass} onClick={onSearch}>
        {label}
        {arrow}
      </button>
    )
  }

  return (
    <Link
      to="/editor"
      search={{
        url: next.item.sourceUrl,
        project: project.publicId,
        from: originParam({ kind: 'project', id: project.publicId }),
      }}
      className={stepLinkClass}
    >
      {label}
      {arrow}
    </Link>
  )
}

function stepLabel(next: NextStep) {
  switch (next.kind) {
    case 'add-address':
      return 'Add the property address'
    case 'find-permit':
      return 'Find a permit'
    case 'start-form':
      return `Start ${next.item.title}`
    case 'continue-form':
      return `Keep filling ${next.item.title}`
  }
}

// Forms started outside a project, each one click from joining one.
function LoneDraftsSection({ drafts }: { drafts: Array<DraftSummary> }) {
  const router = useRouter()
  const [adding, setAdding] = useState<DraftSummary>()
  const shown = drafts.slice(0, LONE_DRAFT_COUNT)

  return (
    <DashboardSection
      label={`Forms not in a project (${drafts.length})`}
      seeAll={
        drafts.length > shown.length && (
          <Link to="/drafts" className={seeAllClass}>
            See all
          </Link>
        )
      }
    >
      <ul className="mt-3 divide-y divide-ink/20 border-t border-b border-ink">
        {shown.map((draft) => (
          <li
            key={draft.publicId}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4"
          >
            <Link
              to="/editor"
              search={{ url: draft.sourceUrl, from: 'drafts' }}
              className="group min-w-0 flex-1"
            >
              <p className="truncate font-medium text-ink group-hover:text-blueprint">
                {draft.title}
              </p>
              <p className="mt-0.5 truncate text-sm text-ink/60">
                {draft.search ? `${draft.search.label} · ` : ''}Edited{' '}
                <EditedDate iso={draft.updatedAt} />
              </p>
            </Link>
            <button
              type="button"
              className={stepLinkClass}
              onClick={() => setAdding(draft)}
            >
              Add to project
            </button>
          </li>
        ))}
      </ul>

      <AddToProjectDialog
        isOpen={adding !== undefined}
        item={{
          sourceUrl: adding?.sourceUrl ?? '',
          title: adding?.title ?? '',
          searchSlug: adding?.search?.slug,
        }}
        city={null}
        onClose={() => setAdding(undefined)}
        onChange={(projects) => {
          setAccountProjects(projects)
          void router.invalidate()
        }}
      />
    </DashboardSection>
  )
}

const STEPS = [
  {
    title: 'Search for a permit',
    body: 'Pick your city and describe the work. We find the official forms.',
    action: 'Search',
  },
  {
    title: 'Start a project',
    body: 'Enter the address, owner and contractor once.',
    link: { to: '/projects/new', label: 'New project' },
  },
  {
    title: 'Fill out the forms',
    body: 'Open a PDF form and fill it from your project.',
  },
] as const

// For a new account with nothing to show yet. onSearch opens the header's
// search modal.
function GettingStarted({ onSearch }: { onSearch: () => void }) {
  return (
    <ol className="mt-10 divide-y divide-ink/20 border-t border-b border-ink">
      {STEPS.map((step, index) => (
        <li key={step.title} className="flex items-start gap-4 py-5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-ink text-sm font-medium text-ink">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{step.title}</p>
            <p className="mt-0.5 text-base leading-6 text-ink/70">
              {step.body}
            </p>
          </div>
          {'action' in step && (
            <button type="button" className={stepLinkClass} onClick={onSearch}>
              {step.action}
            </button>
          )}
          {'link' in step && (
            <Link to={step.link.to} className={stepLinkClass}>
              {step.link.label}
            </Link>
          )}
        </li>
      ))}
    </ol>
  )
}
