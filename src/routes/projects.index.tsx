import { Link, createFileRoute } from '@tanstack/react-router'

import { AppPage } from '#/components/AppPage'
import { EditedDate } from '#/components/EditedDate'
import { SignInButton } from '#/components/SignInDialog'
import { listAccountProjects } from '#/lib/projects/projects'
import { formatProjectAddress } from '#/lib/projects/types'

export const Route = createFileRoute('/projects/')({
  head: () => ({
    meta: [{ title: 'Projects | Permit Search' }],
  }),
  loader: () => listAccountProjects(),
  component: Projects,
})

const buttonClass =
  'inline-flex shrink-0 items-center rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'

function Projects() {
  const projects = Route.useLoaderData()

  return (
    <AppPage>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            Projects
          </p>
          <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            Your projects
          </h1>
        </div>
        {projects && projects.length > 0 && (
          <Link to="/projects/new" className={buttonClass}>
            New project
          </Link>
        )}
      </div>

      {!projects ? (
        <div className="mt-6 border-t border-ink pt-5">
          <p className="text-base leading-6 text-ink/70">
            Sign in to keep your property and contact details in projects,
            and fill out permit forms with them.
          </p>
          <SignInButton className={`mt-5 ${buttonClass}`} />
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-6 border-t border-ink pt-5">
          <p className="max-w-[60ch] text-base leading-6 text-ink/70">
            A project holds what permit forms ask for: the property’s
            address and parcel number, the owner, the contractor, and the
            work. Enter it once, then fill in any form from it and keep the
            forms for the job together.
          </p>
          <Link to="/projects/new" className={`mt-5 ${buttonClass}`}>
            Start a project
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-ink/20 border-t border-b border-ink">
          {projects.map((project) => {
            const address = formatProjectAddress(project)

            return (
              <li key={project.publicId} className="relative">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.publicId }}
                  className="group flex items-center gap-4 py-4 transition hover:bg-ink/[0.04] sm:-mx-3 sm:px-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg leading-6 font-medium text-ink group-hover:text-blueprint">
                      {project.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink/60">
                      {address || 'No address yet'}
                    </p>
                    <p className="mt-0.5 text-sm text-ink/60">
                      {project.items.length}{' '}
                      {project.items.length === 1 ? 'form' : 'forms'} ·
                      Updated <EditedDate iso={project.updatedAt} />
                    </p>
                  </div>
                  <svg
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink/40 transition group-hover:text-blueprint"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m9 18 6-6-6-6"
                    />
                  </svg>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </AppPage>
  )
}
