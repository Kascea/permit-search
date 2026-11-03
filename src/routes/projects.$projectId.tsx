import {
  Link,
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { EditedDate } from '#/components/EditedDate'
import { Pending } from '#/components/Pending'
import { ProjectForm } from '#/components/ProjectForm'
import { SignInButton } from '#/components/SignInDialog'
import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { listAccountDrafts } from '#/lib/drafts/drafts'
import type { DraftSummary } from '#/lib/drafts/types'
import {
  deleteAccountProject,
  getAccountProject,
  removeFromAccountProject,
  updateAccountProject,
} from '#/lib/projects/projects'
import { formatProjectAddress } from '#/lib/projects/types'
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

const buttonClass =
  'inline-flex items-center gap-2 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'
const linkButtonClass =
  'inline-flex items-center gap-1.5 text-sm text-ink/60 underline-offset-2 transition hover:text-redline hover:underline disabled:cursor-wait'

function ProjectPage() {
  const { project, drafts } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  if (!project) {
    return (
      <Page>
        <div className="mt-6 border-t border-ink pt-5">
          <p className="text-base leading-6 text-ink/70">
            Sign in to see this project.
          </p>
          <SignInButton className={`mt-5 ${buttonClass}`} />
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
          <h1 className="mt-1 text-[28px] leading-[1.05] font-medium tracking-[-0.03em] break-words text-ink sm:text-4xl">
            {project.name}
          </h1>
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

function Page({
  children,
  ...header
}: {
  children: ReactNode
} & React.ComponentProps<typeof SiteHeader>) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader {...header} />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        <section className="mx-auto max-w-[780px] py-8">
          <Link
            to="/projects"
            className="mb-5 inline-flex items-center gap-1 text-sm text-ink/60 transition hover:text-ink"
          >
            <span aria-hidden="true">←</span> All projects
          </Link>
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
                    {hostname(item.sourceUrl)}
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
                  search={{ url: item.sourceUrl, project: project.publicId }}
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
