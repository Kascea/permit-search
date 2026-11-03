import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { Breadcrumbs, crumbLinkClass } from '#/components/Breadcrumbs'
import { primaryButtonClass } from '#/components/buttons'
import { EditedDate } from '#/components/EditedDate'
import { Pending } from '#/components/Pending'
import { ProjectForm } from '#/components/ProjectForm'
import { SearchLinkText } from '#/components/SearchLinkText'
import { SignInButton } from '#/components/SignInDialog'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { listAccountDrafts } from '#/lib/drafts/drafts'
import { originParam } from '#/lib/navigation/origin'
import type { DraftSummary } from '#/lib/drafts/types'
import {
  deleteAccountProject,
  getAccountProject,
  removeFromAccountProject,
  updateAccountProject,
} from '#/lib/projects/projects'
import {
  MAX_PROJECT_NAME_LENGTH,
  formatProjectAddress,
} from '#/lib/projects/types'
import type { Project } from '#/lib/projects/types'

export const Route = createFileRoute('/projects/$projectId')({
  loader: async ({ params }) => {
    if (!/^[A-Za-z0-9]{8,16}$/.test(params.projectId)) throw notFound()
    const [found, drafts] = await Promise.all([
      getAccountProject({ data: { publicId: params.projectId } }),
      listAccountDrafts(),
    ])
    // Signed out: the page asks the visitor to sign in.
    if (!found) return { project: null, drafts: [] }
    if (!found.project) throw notFound()
    return { project: found.project, drafts: drafts ?? [] }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.project
          ? `${loaderData.project.name} | Permit Search`
          : 'Project | Permit Search',
      },
    ],
  }),
  component: ProjectPage,
  notFoundComponent: () => (
    <Page>
      <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
        This project doesn’t exist, or it belongs to another account.{' '}
        <Link
          to="/projects"
          className="font-medium text-blueprint underline-offset-2 hover:underline"
        >
          See your projects
        </Link>
      </p>
    </Page>
  ),
})

const linkButtonClass =
  'inline-flex items-center gap-1.5 text-sm text-ink/60 underline-offset-2 transition hover:text-redline hover:underline disabled:cursor-wait'

function ProjectPage() {
  const { project, drafts } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // The title's name, saved with the details form; see ProjectTitle.
  const formId = useId()
  const [name, setName] = useState(project?.name ?? '')
  const [savedName, setSavedName] = useState(project?.name)
  if (project && project.name !== savedName) {
    setSavedName(project.name)
    setName(project.name)
  }

  if (!project) {
    return (
      <Page>
        <div className="mt-6 border-t border-ink pt-5">
          <p className="text-base leading-6 text-ink/70">
            Sign in to see this project.
          </p>
          <SignInButton className={`mt-5 ${primaryButtonClass}`} />
        </div>
      </Page>
    )
  }

  async function remove(current: Project) {
    if (
      !window.confirm(
        `Delete the project “${current.name}”? Your drafts stay in Drafts.`,
      )
    ) {
      return
    }
    setIsDeleting(true)
    try {
      await deleteAccountProject({ data: { publicId: current.publicId } })
      toast.success('Project deleted.')
      await navigate({ to: '/projects' })
    } catch {
      toast.error('The project couldn’t be deleted. Try again.')
      setIsDeleting(false)
    }
  }

  const address = formatProjectAddress(project)

  return (
    <Page
      projectName={project.name}
      // The search modal starts in the project's city.
      search={project.city ? { city: project.city, permit: '' } : undefined}
      isSearchOpen={isSearchOpen}
      onSearchOpenChange={setIsSearchOpen}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            Project
          </p>
          <ProjectTitle
            name={name}
            savedName={project.name}
            formId={formId}
            onChange={setName}
          />
          <p className="mt-2 text-base leading-6 text-ink/70">
            {address || 'No address yet'}
          </p>
        </div>
        <button
          type="button"
          disabled={isDeleting}
          className={linkButtonClass}
          onClick={() => void remove(project)}
        >
          <span className="text-sm">
            <Pending isPending={isDeleting} label="Deleting…">
              Delete project
            </Pending>
          </span>
        </button>
      </div>

      <FormsSection
        project={project}
        drafts={drafts}
        onFindForms={() => setIsSearchOpen(true)}
      />

      <section className="mt-10">
        <h2 className="text-lg leading-6 font-medium text-ink">Details</h2>
        <p className="mt-1 text-sm leading-6 text-ink/60">
          What this project fills into its forms. Change anything here and save.
        </p>
        <ProjectForm
          variant="edit"
          formId={formId}
          name={name}
          onNameChange={setName}
          initial={project}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          onSubmit={async (input) => {
            await updateAccountProject({
              data: { ...input, publicId: project.publicId },
            })
            await router.invalidate()
            toast.success('Project saved.')
          }}
        />
      </section>
    </Page>
  )
}

const titleClass =
  'text-[28px] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl'

// The project's name, with a pencil to rename it in place. The name joins
// the details form below, so its save bar saves or discards the rename with
// everything else. Enter saves; Escape puts the saved name back.
function ProjectTitle({
  name,
  savedName,
  formId,
  onChange,
}: {
  name: string
  savedName: string
  formId: string
  onChange: (name: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  // A save (such as Enter in the input) ends editing.
  const [lastSavedName, setLastSavedName] = useState(savedName)
  if (savedName !== lastSavedName) {
    setLastSavedName(savedName)
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <div className="mt-1 flex items-start gap-2">
        <h1
          className={`${titleClass} min-w-0 break-words ${
            name.trim() ? '' : 'text-ink/40'
          }`}
        >
          {name.trim() || 'Untitled project'}
        </h1>
        <button
          type="button"
          aria-label="Rename project"
          title="Rename project"
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-ink/10 hover:text-ink focus-visible:text-ink sm:mt-1"
          onClick={() => setIsEditing(true)}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
            />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="mt-1">
      <h1 className="sr-only">{savedName}</h1>
      <input
        aria-label="Project name"
        autoFocus
        form={formId}
        className={`${titleClass} w-full min-w-0 border-b border-blueprint bg-transparent outline-none`}
        maxLength={MAX_PROJECT_NAME_LENGTH}
        placeholder="Untitled project"
        value={name}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange(savedName)
            setIsEditing(false)
          }
        }}
      />
    </div>
  )
}

function Page({
  children,
  projectName,
  ...header
}: {
  children: ReactNode
  // Ends the breadcrumb once the project has loaded.
  projectName?: string
} & React.ComponentProps<typeof SiteHeader>) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader {...header} />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        <section className="mx-auto max-w-[780px] py-8">
          <Breadcrumbs
            className="mb-5"
            current={
              projectName === undefined ? undefined : (
                <span className="text-ink">{projectName}</span>
              )
            }
          >
            <Link
              to="/projects"
              activeOptions={{ exact: true }}
              className={crumbLinkClass}
            >
              Projects
            </Link>
          </Breadcrumbs>
          {children}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

// The project's PDFs, each opened in the editor with this project's details
// ready to fill in.
function FormsSection({
  project,
  drafts,
  onFindForms,
}: {
  project: Project
  drafts: Array<DraftSummary>
  onFindForms: () => void
}) {
  const router = useRouter()
  const [removingUrl, setRemovingUrl] = useState<string>()
  const draftsByUrl = new Map(drafts.map((draft) => [draft.sourceUrl, draft]))

  async function removeItem(sourceUrl: string) {
    setRemovingUrl(sourceUrl)
    try {
      await removeFromAccountProject({
        data: { publicId: project.publicId, sourceUrl },
      })
      await router.invalidate()
    } catch {
      toast.error('That form couldn’t be removed. Try again.')
    } finally {
      setRemovingUrl(undefined)
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-3">
        <h2 className="text-lg leading-6 font-medium text-ink">Forms</h2>
        <button
          type="button"
          className="rounded-full border border-ink/40 px-3 py-1 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper"
          onClick={onFindForms}
        >
          <span className="text-xs">Find forms</span>
        </button>
      </div>
      {project.items.length === 0 ? (
        <p className="border-b border-ink py-5 text-base leading-6 text-ink/70">
          No forms yet. Search for{' '}
          {project.city ? `${project.city.name}’s` : 'your city’s'} permit forms
          and choose “Add to project” on a PDF.
        </p>
      ) : (
        <ul className="divide-y divide-ink/20 border-b border-ink">
          {project.items.map((item) => {
            const draft = draftsByUrl.get(item.sourceUrl)
            const isRemoving = removingUrl === item.sourceUrl
            return (
              <li
                key={item.sourceUrl}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-3 transition-opacity ${
                  isRemoving ? 'opacity-50' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{item.title}</p>
                  <p className="truncate text-sm text-ink/60">
                    {item.search ? (
                      <SearchLinkText search={item.search} />
                    ) : (
                      hostname(item.sourceUrl)
                    )}
                    {draft ? (
                      <>
                        {' · '}
                        <span className="text-success">
                          Draft edited <EditedDate iso={draft.updatedAt} />
                        </span>
                      </>
                    ) : (
                      ' · Not started'
                    )}
                  </p>
                </div>
                <Link
                  to="/editor"
                  search={{
                    url: item.sourceUrl,
                    from: originParam({
                      kind: 'project',
                      id: project.publicId,
                    }),
                  }}
                  className="shrink-0 rounded-full bg-blueprint px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
                >
                  {draft ? 'Continue' : 'Fill out'}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${item.title} from ${project.name}`}
                  disabled={removingUrl !== undefined}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-ink/35 px-4 py-1.5 text-sm font-medium text-ink transition hover:border-redline hover:text-redline disabled:cursor-wait"
                  onClick={() => void removeItem(item.sourceUrl)}
                >
                  <Pending isPending={isRemoving} label="Removing…">
                    Remove
                  </Pending>
                </button>
              </li>
            )
          })}
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
