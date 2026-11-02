import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'

import { AddToProjectDialog } from '#/components/AddToProjectDialog'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { SignInButton } from '#/components/SignInDialog'
import { deleteAccountDraft, listAccountDrafts } from '#/lib/drafts/drafts'
import type { DraftSummary } from '#/lib/drafts/types'
import { formatCity } from '#/lib/location/format'
import {
  createAccountProject,
  deleteAccountProject,
  listAccountProjects,
  removeFromAccountProject,
  renameAccountProject,
} from '#/lib/projects/projects'
import { MAX_PROJECT_NAME_LENGTH } from '#/lib/projects/types'
import type { Project, ProjectItem } from '#/lib/projects/types'

export const Route = createFileRoute('/drafts')({
  head: () => ({
    meta: [{ title: 'Drafts | Permit Search' }],
  }),
  loader: async () => {
    const [drafts, projects] = await Promise.all([
      listAccountDrafts(),
      listAccountProjects(),
    ])
    return { drafts, projects }
  },
  component: Drafts,
})

function Drafts() {
  const loaded = Route.useLoaderData()
  const { drafts } = loaded
  // Project changes return the updated list, so it's kept here rather than
  // reloading the page. A fresh load (such as after deleting a draft) wins.
  const [projects, setProjects] = useState(loaded.projects)
  const [lastLoaded, setLastLoaded] = useState(loaded)
  if (loaded !== lastLoaded) {
    setLastLoaded(loaded)
    setProjects(loaded.projects)
  }
  // Projects come first when signed in, so they hold the page's h1.
  const DraftsHeading = projects ? 'h2' : 'h1'

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        {drafts && projects && (
          <ProjectsSection
            projects={projects}
            drafts={drafts}
            onChange={setProjects}
          />
        )}

        <section className="mx-auto max-w-[780px] py-8">
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            Drafts
          </p>
          <DraftsHeading className="mt-1 text-[28px] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            Forms you’ve started
          </DraftsHeading>

          {drafts ? (
            <DraftList
              drafts={drafts}
              projects={projects ?? []}
              onProjectsChange={setProjects}
            />
          ) : (
            <div className="mt-6 border-t border-ink pt-5">
              <p className="text-base leading-6 text-ink/70">
                Sign in to see forms you’ve saved to your account. Forms you
                fill out while signed out are saved on this device.
              </p>
              <SignInButton className="mt-5 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep" />
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function DraftList({
  drafts,
  projects,
  onProjectsChange,
}: {
  drafts: Array<DraftSummary>
  projects: Array<Project>
  onProjectsChange: (projects: Array<Project>) => void
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string>()
  // The draft whose "Add to project" dialog is open.
  const [addingDraft, setAddingDraft] = useState<DraftSummary>()
  const projectUrls = new Set(
    projects.flatMap((project) => project.items.map((item) => item.sourceUrl)),
  )
  const [error, setError] = useState('')

  async function remove(draft: DraftSummary) {
    if (!window.confirm(`Delete your draft of “${draft.title}”?`)) return
    setError('')
    setDeletingId(draft.publicId)
    try {
      await deleteAccountDraft({ data: { publicId: draft.publicId } })
      await router.invalidate()
    } catch {
      setError('That draft could not be deleted. Try again.')
    } finally {
      setDeletingId(undefined)
    }
  }

  return (
    <>
      {error && (
        <p className="mt-6 text-sm text-redline" role="alert">
          {error}
        </p>
      )}

      {drafts.length === 0 ? (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          No drafts yet. When you fill out a PDF form from your search results,
          your entries save here automatically.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/20 border-t border-b border-ink">
          {drafts.map((draft) => (
            <li
              key={draft.publicId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{draft.title}</p>
                <p className="mt-0.5 truncate text-sm text-ink/60">
                  {hostname(draft.sourceUrl)} · Edited{' '}
                  {formatEdited(draft.updatedAt)}
                </p>
              </div>
              <Link
                to="/editor"
                search={{ url: draft.sourceUrl }}
                className="rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
              >
                Open
              </Link>
              {!projectUrls.has(draft.sourceUrl) && (
                <button
                  type="button"
                  className="rounded-full border border-ink/35 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
                  onClick={() => setAddingDraft(draft)}
                >
                  Add to project
                </button>
              )}
              <button
                type="button"
                disabled={deletingId === draft.publicId}
                className="rounded-full border border-ink/35 px-4 py-2 text-sm font-medium transition hover:border-redline hover:text-redline disabled:opacity-50"
                onClick={() => void remove(draft)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddToProjectDialog
        isOpen={addingDraft !== undefined}
        item={{
          sourceUrl: addingDraft?.sourceUrl ?? '',
          title: addingDraft?.title ?? '',
        }}
        city={null}
        onClose={() => setAddingDraft(undefined)}
        onChange={onProjectsChange}
      />
    </>
  )
}

// The user's projects, each a ruled group of its PDFs. A PDF with a draft
// says so; Open goes to the editor either way.
function ProjectsSection({
  projects,
  drafts,
  onChange,
}: {
  projects: Array<Project>
  drafts: Array<DraftSummary>
  onChange: (projects: Array<Project>) => void
}) {
  const nameId = useId()
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  // The project being renamed in place, and the name typed so far.
  const [renaming, setRenaming] = useState<{ publicId: string; name: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const draftUrls = new Set(drafts.map((draft) => draft.sourceUrl))

  // Runs one change and shows the list it returns.
  async function run(change: () => Promise<Array<Project>>, failure: string) {
    setError('')
    setBusy(true)
    try {
      onChange(await change())
      return true
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : failure)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await run(
      () => createAccountProject({ data: { name, city: null } }),
      'The project couldn’t be created. Try again.',
    )
    if (created) {
      setName('')
      setIsAdding(false)
    }
  }

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!renaming) return
    const renamed = await run(
      () => renameAccountProject({ data: renaming }),
      'The project couldn’t be renamed. Try again.',
    )
    if (renamed) setRenaming(undefined)
  }

  function remove(project: Project) {
    if (
      !window.confirm(
        `Delete the project “${project.name}”? Your drafts stay in Drafts.`,
      )
    ) {
      return
    }
    void run(
      () => deleteAccountProject({ data: { publicId: project.publicId } }),
      'The project couldn’t be deleted. Try again.',
    )
  }

  function removeItem(project: Project, item: ProjectItem) {
    void run(
      () =>
        removeFromAccountProject({
          data: { publicId: project.publicId, sourceUrl: item.sourceUrl },
        }),
      'That form couldn’t be removed. Try again.',
    )
  }

  return (
    <section className="mx-auto max-w-[780px] py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            Projects
          </p>
          <h1 className="mt-1 text-[28px] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            Your projects
          </h1>
        </div>
        {!isAdding && (
          <button
            type="button"
            className="shrink-0 rounded-full border border-ink/40 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
            onClick={() => setIsAdding(true)}
          >
            New project
          </button>
        )}
      </div>

      {isAdding && (
        <form
          className="mt-6 flex flex-wrap items-end gap-2"
          noValidate
          onSubmit={create}
        >
          <label
            className="w-full text-sm font-medium text-ink"
            htmlFor={nameId}
          >
            Project name
          </label>
          <input
            id={nameId}
            autoFocus
            className="field-input flex-1 py-2.5"
            maxLength={MAX_PROJECT_NAME_LENGTH}
            placeholder="e.g. Backyard fence"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep disabled:opacity-60"
          >
            Create
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:text-ink"
            onClick={() => {
              setIsAdding(false)
              setName('')
              setError('')
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {error && (
        <p className="mt-6 text-sm text-redline" role="alert">
          {error}
        </p>
      )}

      {projects.length === 0 ? (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          No projects yet. Group the forms for one job together: choose “Add to
          project” on a PDF in your search results, or start one here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/20 border-t border-b border-ink">
          {projects.map((project) => (
            <li key={project.publicId} className="py-5">
              {renaming?.publicId === project.publicId ? (
                <form
                  className="flex flex-wrap items-center gap-2"
                  noValidate
                  onSubmit={rename}
                >
                  <input
                    aria-label="Project name"
                    autoFocus
                    className="field-input min-w-0 flex-1 py-2 text-lg"
                    maxLength={MAX_PROJECT_NAME_LENGTH}
                    value={renaming.name}
                    onChange={(event) =>
                      setRenaming({ ...renaming, name: event.target.value })
                    }
                    onFocus={(event) => event.target.select()}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setRenaming(undefined)
                    }}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep disabled:cursor-wait"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 text-sm font-medium text-ink/70 transition hover:text-ink"
                    onClick={() => setRenaming(undefined)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 text-lg leading-6 font-medium text-ink">
                    {project.name}
                    {project.city && (
                      <span className="font-normal text-ink/60">
                        {' '}
                        · {formatCity(project.city)}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-4 text-sm">
                    <button
                      type="button"
                      disabled={busy}
                      className="text-ink/60 underline-offset-2 transition hover:text-ink hover:underline"
                      onClick={() => {
                        setError('')
                        setRenaming({
                          publicId: project.publicId,
                          name: project.name,
                        })
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-ink/60 underline-offset-2 transition hover:text-redline hover:underline"
                      onClick={() => remove(project)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {project.items.length === 0 ? (
                <p className="mt-2 text-sm text-ink/60">
                  No forms yet. Choose “Add to project” on a PDF in your search
                  results.
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {project.items.map((item) => (
                    <li
                      key={item.sourceUrl}
                      className="flex items-center gap-3 rounded-[2px] py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink">{item.title}</p>
                        <p className="truncate text-sm text-ink/60">
                          {hostname(item.sourceUrl)}
                          {draftUrls.has(item.sourceUrl) && (
                            <>
                              {' · '}
                              <span className="text-success">
                                Draft started
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Link
                        to="/editor"
                        search={{ url: item.sourceUrl }}
                        className="shrink-0 rounded-full bg-blueprint px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title} from ${project.name}`}
                        disabled={busy}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-ink/50 transition hover:bg-redline/10 hover:text-redline"
                        onClick={() => removeItem(project, item)}
                      >
                        <svg
                          aria-hidden="true"
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            d="M6 6l12 12M18 6 6 18"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatEdited(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
