import {
  Link,
  createFileRoute,
  useHydrated,
  useRouter,
} from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { errorMessage } from '#/lib/errors'
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
  // The header owns the search modal; empty states open it too.
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const startSearch = () => setIsSearchOpen(true)
  if (loaded !== lastLoaded) {
    setLastLoaded(loaded)
    setProjects(loaded.projects)
  }
  const deleting = useDeleteDraft()
  // Projects come first when signed in, so they hold the page's h1.
  const DraftsHeading = projects ? 'h2' : 'h1'
  const hasProjects = projects !== null && projects.length > 0
  // Drafts of PDFs in a project are shown under that project instead.
  const projectUrls = new Set(
    projects?.flatMap((project) => project.items.map((item) => item.sourceUrl)),
  )
  const otherDrafts = drafts?.filter(
    (draft) => !projectUrls.has(draft.sourceUrl),
  )

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        isSearchOpen={isSearchOpen}
        onSearchOpenChange={setIsSearchOpen}
      />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        {drafts && projects && (
          <ProjectsSection
            projects={projects}
            drafts={drafts}
            deleting={deleting}
            onChange={setProjects}
            onStartSearch={startSearch}
          />
        )}

        <section className="mx-auto max-w-[780px] py-8">
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            Drafts
          </p>
          <DraftsHeading className="mt-1 text-[28px] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            {hasProjects ? 'Not in a project' : 'Forms you’ve started'}
          </DraftsHeading>

          {drafts && otherDrafts ? (
            <DraftList
              drafts={otherDrafts}
              allInProjects={drafts.length > 0}
              deleting={deleting}
              onProjectsChange={setProjects}
              onStartSearch={startSearch}
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

// Deleting a draft, from either the projects or the drafts list.
type DeleteDraft = ReturnType<typeof useDeleteDraft>

function useDeleteDraft() {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string>()

  async function remove(draft: DraftSummary) {
    if (!window.confirm(`Delete your draft of “${draft.title}”?`)) return
    setDeletingId(draft.publicId)
    try {
      await deleteAccountDraft({ data: { publicId: draft.publicId } })
      await router.invalidate()
      toast.success('Draft deleted.')
    } catch {
      toast.error('That draft couldn’t be deleted. Try again.')
    } finally {
      setDeletingId(undefined)
    }
  }

  return { deletingId, remove }
}

// Drafts of PDFs that aren't in any project.
function DraftList({
  drafts,
  allInProjects,
  deleting,
  onProjectsChange,
  onStartSearch,
}: {
  drafts: Array<DraftSummary>
  // There are drafts, and every one is listed under a project.
  allInProjects: boolean
  deleting: DeleteDraft
  onProjectsChange: (projects: Array<Project>) => void
  onStartSearch: () => void
}) {
  const { deletingId, remove } = deleting
  // The draft whose "Add to project" dialog is open.
  const [addingDraft, setAddingDraft] = useState<DraftSummary>()

  return (
    <>
      {drafts.length === 0 && allInProjects ? (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          Every form you’ve started is in a project.
        </p>
      ) : drafts.length === 0 ? (
        <div className="mt-6 border-t border-ink pt-5">
          <p className="text-base leading-6 text-ink/70">
            No drafts yet. When you fill out a PDF form from your search
            results, your entries save here automatically.
          </p>
          <StartSearchButton onClick={onStartSearch} />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-ink/20 border-t border-b border-ink">
          {drafts.map((draft) => (
            <li
              key={draft.publicId}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-4 transition-opacity ${
                deletingId === draft.publicId ? 'opacity-50' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{draft.title}</p>
                <p className="mt-0.5 truncate text-sm text-ink/60">
                  {hostname(draft.sourceUrl)} · Edited{' '}
                  <EditedDate iso={draft.updatedAt} />
                </p>
              </div>
              <Link
                to="/editor"
                search={{ url: draft.sourceUrl }}
                className="rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
              >
                Open
              </Link>
              <button
                type="button"
                className="rounded-full border border-ink/35 px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
                onClick={() => setAddingDraft(draft)}
              >
                Add to project
              </button>
              <button
                type="button"
                disabled={deletingId === draft.publicId}
                className="inline-flex items-center gap-2 rounded-full border border-ink/35 px-4 py-2 text-sm font-medium transition hover:border-redline hover:text-redline disabled:cursor-wait"
                onClick={() => void remove(draft)}
              >
                <Pending
                  isPending={deletingId === draft.publicId}
                  label="Deleting…"
                >
                  Delete
                </Pending>
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

// The user's projects, each a ruled group of its PDFs. A PDF's draft is
// shown, and can be deleted, under its project; Open goes to the editor
// either way.
function ProjectsSection({
  projects,
  drafts,
  deleting,
  onChange,
  onStartSearch,
}: {
  projects: Array<Project>
  drafts: Array<DraftSummary>
  deleting: DeleteDraft
  onChange: (projects: Array<Project>) => void
  onStartSearch: () => void
}) {
  const nameId = useId()
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  // The project being renamed in place, and the name typed so far.
  const [renaming, setRenaming] = useState<{ publicId: string; name: string }>()
  // The change in flight, such as "rename:<publicId>", so its own button can
  // show progress while the others wait.
  const [pending, setPending] = useState<string>()
  const busy = pending !== undefined
  const [error, setError] = useState('')
  const draftsByUrl = new Map(drafts.map((draft) => [draft.sourceUrl, draft]))

  // Runs one change and shows the list it returns.
  async function run(
    key: string,
    change: () => Promise<Array<Project>>,
    failure: string,
  ) {
    setError('')
    setPending(key)
    try {
      onChange(await change())
      return true
    } catch (changeError) {
      setError(errorMessage(changeError, failure))
      return false
    } finally {
      setPending(undefined)
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await run(
      'create',
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
      `rename:${renaming.publicId}`,
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
      `delete:${project.publicId}`,
      () => deleteAccountProject({ data: { publicId: project.publicId } }),
      'The project couldn’t be deleted. Try again.',
    )
  }

  function removeItem(project: Project, item: ProjectItem) {
    void run(
      `remove:${project.publicId}:${item.sourceUrl}`,
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
            className="inline-flex items-center gap-2 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep disabled:cursor-wait disabled:opacity-80"
          >
            <Pending isPending={pending === 'create'} label="Creating…" onFill>
              Create
            </Pending>
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
        <div className="mt-6 border-t border-ink pt-5">
          <p className="text-base leading-6 text-ink/70">
            No projects yet. Group the forms for one job together: choose “Add
            to project” on a PDF in your search results, or start one here.
          </p>
          <StartSearchButton onClick={onStartSearch} />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-ink/20 border-t border-b border-ink">
          {projects.map((project) => (
            <li
              key={project.publicId}
              className={`py-5 transition-opacity ${
                pending === `delete:${project.publicId}` ? 'opacity-50' : ''
              }`}
            >
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
                    className="inline-flex items-center gap-2 rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep disabled:cursor-wait disabled:opacity-80"
                  >
                    <Pending
                      isPending={pending === `rename:${project.publicId}`}
                      label="Saving…"
                      onFill
                    >
                      Save
                    </Pending>
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
                      className="text-ink/60 underline-offset-2 transition hover:text-ink hover:underline disabled:cursor-wait"
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
                      className="inline-flex items-center gap-1.5 text-ink/60 underline-offset-2 transition hover:text-redline hover:underline disabled:cursor-wait"
                      onClick={() => remove(project)}
                    >
                      <Pending
                        isPending={pending === `delete:${project.publicId}`}
                        label="Deleting…"
                      >
                        Delete
                      </Pending>
                    </button>
                  </div>
                </div>
              )}

              {project.items.length === 0 ? (
                <p className="mt-2 text-sm text-ink/60">
                  No forms yet. Choose “Add to project” on a PDF in your search
                  results.{' '}
                  <button
                    type="button"
                    className="font-medium text-blueprint underline-offset-2 hover:underline"
                    onClick={onStartSearch}
                  >
                    <span className="text-sm">Search for forms</span>
                  </button>
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {project.items.map((item) => {
                    const draft = draftsByUrl.get(item.sourceUrl)
                    const isRemoving =
                      pending === `remove:${project.publicId}:${item.sourceUrl}`
                    const isDeletingDraft =
                      draft !== undefined &&
                      deleting.deletingId === draft.publicId
                    return (
                      <li
                        key={item.sourceUrl}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[2px] py-1.5 transition-opacity ${
                          isRemoving || isDeletingDraft ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ink">{item.title}</p>
                          <p className="truncate text-sm text-ink/60">
                            {hostname(item.sourceUrl)}
                            {draft && (
                              <>
                                {' · '}
                                <span className="text-success">
                                  Draft edited{' '}
                                  <EditedDate iso={draft.updatedAt} />
                                </span>
                                {' · '}
                                <button
                                  type="button"
                                  disabled={isDeletingDraft}
                                  className="inline-flex items-center gap-1.5 align-bottom underline-offset-2 transition hover:text-redline hover:underline disabled:cursor-wait"
                                  onClick={() => void deleting.remove(draft)}
                                >
                                  <span className="text-sm">
                                    <Pending
                                      isPending={isDeletingDraft}
                                      label="Deleting draft…"
                                    >
                                      Delete draft
                                    </Pending>
                                  </span>
                                </button>
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
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-ink/35 px-4 py-1.5 text-sm font-medium text-ink transition hover:border-redline hover:text-redline disabled:cursor-wait"
                          onClick={() => removeItem(project, item)}
                        >
                          <Pending isPending={isRemoving} label="Removing…">
                            Remove from project
                          </Pending>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// A button's label, or a spinner and what's happening while its action runs.
// onFill is for buttons filled with blue, where the spinner is light.
function Pending({
  isPending,
  label,
  onFill = false,
  children,
}: {
  isPending: boolean
  label: string
  onFill?: boolean
  children: ReactNode
}) {
  if (!isPending) return children
  return (
    <>
      <span
        className={`spinner size-3.5 ${
          onFill ? 'border-paper/30 border-t-paper' : ''
        }`}
      />
      <span role="status">{label}</span>
    </>
  )
}

// Opens the search modal from an empty list.
function StartSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="mt-4 inline-flex items-center gap-2 rounded-full border border-blueprint px-4 py-2 font-medium text-blueprint transition hover:bg-blueprint hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        className="size-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
      {/* Sized on the span: the global button font rule overrides it on the
          button itself. */}
      <span className="text-sm">Start searching</span>
    </button>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// The server renders in UTC and the browser in the visitor's time zone, so
// the date is shown in UTC until hydration, then in the visitor's own zone.
// Formatting in the visitor's zone straight away broke hydration near midnight.
function EditedDate({ iso }: { iso: string }) {
  const isHydrated = useHydrated()
  return (
    <time dateTime={iso}>
      {new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: isHydrated ? undefined : 'UTC',
      })}
    </time>
  )
}
