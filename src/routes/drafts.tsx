import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AppPage } from '#/components/AppPage'
import { DraftName } from '#/components/DraftName'
import { AddToProjectDialog } from '#/components/AddToProjectDialog'
import { EditedDate } from '#/components/EditedDate'
import { SearchLinkText } from '#/components/SearchLinkText'
import { Pending } from '#/components/Pending'
import { SignInGate } from '#/components/SignInGate'
import { deleteAccountDraft, listAccountDrafts } from '#/lib/drafts/drafts'
import { deleteLocalDraft, listLocalDrafts } from '#/lib/drafts/local'
import { draftTitle } from '#/lib/drafts/types'
import type { Draft, DraftSummary } from '#/lib/drafts/types'
import { listAccountProjects } from '#/lib/projects/projects'
import type { Project } from '#/lib/projects/types'
import { confirm } from '#/components/ConfirmDialog'

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
  // "Add to project" returns the updated list, so it's kept here rather than
  // reloading the page. A fresh load (such as after deleting a draft) wins.
  const [projects, setProjects] = useState(loaded.projects)
  const [lastLoaded, setLastLoaded] = useState(loaded)
  // The header owns the search modal; the empty state opens it too.
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  if (loaded !== lastLoaded) {
    setLastLoaded(loaded)
    setProjects(loaded.projects)
  }

  return (
    <AppPage
      isSearchOpen={isSearchOpen}
      onSearchOpenChange={setIsSearchOpen}
    >
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        Drafts
      </p>
      <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        Forms you’ve started
      </h1>

      {drafts && projects ? (
        <DraftList
          drafts={drafts}
          projects={projects}
          onProjectsChange={setProjects}
          onStartSearch={() => setIsSearchOpen(true)}
        />
      ) : (
        <LocalDraftList onStartSearch={() => setIsSearchOpen(true)} />
      )}
    </AppPage>
  )
}

// Signed out: the forms started in this browser, which sign-in moves to the
// account (see LocalDraftSync). They're only readable in the browser, so the
// list fills in after the page loads.
function LocalDraftList({ onStartSearch }: { onStartSearch: () => void }) {
  const [drafts, setDrafts] = useState<Array<Draft>>()

  useEffect(() => {
    setDrafts(readLocalDrafts())
  }, [])

  async function remove(draft: Draft) {
    if (
      !(await confirm({
        title: `Delete your draft of “${draftTitle(draft.sourceUrl)}”?`,
        confirmLabel: 'Delete draft',
        isDestructive: true,
      }))
    ) {
      return
    }

    deleteLocalDraft(draft.sourceUrl)
    setDrafts(readLocalDrafts())
    toast.success('Draft deleted.')
  }

  return (
    <>
      {drafts && drafts.length > 0 ? (
        // No rule below: the sign-in prompt's closes it.
        <ul className="mt-6 divide-y divide-ink/20 border-t border-ink">
          {drafts.map((draft) => (
            <li
              key={draft.sourceUrl}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {draftTitle(draft.sourceUrl)}
                </p>
                <p className="mt-0.5 truncate text-sm text-ink/60">
                  {hostname(draft.sourceUrl)} · Edited{' '}
                  <EditedDate iso={draft.updatedAt} />
                </p>
              </div>
              <Link
                to="/editor"
                search={{ url: draft.sourceUrl, from: 'drafts' }}
                className="rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
              >
                Open
              </Link>
              <button
                type="button"
                className="rounded-full border border-ink/35 px-4 py-2 text-sm font-medium transition hover:border-redline hover:text-redline"
                onClick={() => void remove(draft)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        drafts && (
          <div className="mt-6 border-t border-ink pt-5">
            <p className="text-base leading-6 text-ink/70">
              No drafts yet. When you fill out a PDF form from your search
              results, your entries save here automatically.
            </p>
            <StartSearchButton onClick={onStartSearch} />
          </div>
        )
      )}

      <SignInGate>
        Forms you fill out while signed out are saved on this device only. Sign
        in to keep them in your account and open them anywhere.
      </SignInGate>
    </>
  )
}

function readLocalDrafts() {
  return listLocalDrafts().sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

function DraftList({
  drafts,
  projects,
  onProjectsChange,
  onStartSearch,
}: {
  drafts: Array<DraftSummary>
  projects: Array<Project>
  onProjectsChange: (projects: Array<Project>) => void
  onStartSearch: () => void
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string>()
  // The draft whose "Add to project" dialog is open.
  const [addingDraft, setAddingDraft] = useState<DraftSummary>()

  async function remove(draft: DraftSummary) {
    if (
      !(await confirm({
        title: `Delete your draft of “${draft.name ?? draft.title}”?`,
        confirmLabel: 'Delete draft',
        isDestructive: true,
      }))
    ) {
      return
    }

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

  if (drafts.length === 0) {
    return (
      <div className="mt-6 border-t border-ink pt-5">
        <p className="text-base leading-6 text-ink/70">
          No drafts yet. When you fill out a PDF form from your search results,
          your entries save here automatically.
        </p>
        <StartSearchButton onClick={onStartSearch} />
      </div>
    )
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-ink/20 border-t border-b border-ink">
        {drafts.map((draft) => {
          // The first project holding this PDF; it opens with that project's
          // details ready to fill in.
          const project = projects.find((each) =>
            each.items.some((item) => item.sourceUrl === draft.sourceUrl),
          )

          return (
            <li
              key={draft.publicId}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-4 transition-opacity ${
                deletingId === draft.publicId ? 'opacity-50' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <DraftName
                  publicId={draft.publicId}
                  name={draft.name}
                  formTitle={draft.title}
                  className="font-medium text-ink"
                />
                <p className="mt-0.5 truncate text-sm text-ink/60">
                  {/* Renamed drafts keep the form they're for in view. */}
                  {draft.name && `${draft.title} · `}
                  {project ? (
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.publicId }}
                      className="text-blueprint underline-offset-2 hover:underline"
                    >
                      {project.name}
                    </Link>
                  ) : draft.search ? (
                    <SearchLinkText search={draft.search} />
                  ) : (
                    hostname(draft.sourceUrl)
                  )}{' '}
                  · Edited <EditedDate iso={draft.updatedAt} />
                </p>
              </div>
              <Link
                to="/editor"
                search={{
                  url: draft.sourceUrl,
                  project: project?.publicId,
                  from: 'drafts',
                }}
                className="rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
              >
                Open
              </Link>
              {!project && (
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
          )
        })}
      </ul>

      <AddToProjectDialog
        isOpen={addingDraft !== undefined}
        item={{
          sourceUrl: addingDraft?.sourceUrl ?? '',
          title: addingDraft?.title ?? '',
          searchId: addingDraft?.search?.publicId,
        }}
        city={null}
        onClose={() => setAddingDraft(undefined)}
        onChange={onProjectsChange}
      />
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
