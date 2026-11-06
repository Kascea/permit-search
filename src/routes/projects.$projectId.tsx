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

import { AppPage } from '#/components/AppPage'
import { Breadcrumbs, crumbLinkClass } from '#/components/Breadcrumbs'
import { quietActionClass } from '#/components/buttons'
import { DraftName } from '#/components/DraftName'
import { EditedDate } from '#/components/EditedDate'
import { Notice } from '#/components/Notice'
import { Pending } from '#/components/Pending'
import { PermitNumberDialog } from '#/components/PermitNumberDialog'
import { ProjectForm } from '#/components/ProjectForm'
import { SearchLinkText } from '#/components/SearchLinkText'
import { SignInGate } from '#/components/SignInGate'
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
import type { Project, ProjectItem } from '#/lib/projects/types'
import { setAccountProjects } from '#/lib/projects/use-account-projects'
import {
  checkProjectFormPermit,
  removeProjectFormPermit,
} from '#/lib/portals/tracking'
import { checkToast } from '#/lib/portals/messages'
import type {
  PermitPhase,
  PermitStatus,
  PortalPermitType,
  TrackedPermit,
} from '#/lib/portals/types'
import { errorMessage } from '#/lib/errors'
import { confirm } from '#/components/ConfirmDialog'

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
  component: ProjectRoute,
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

// Going from one project to another (such as from the sidebar) keeps this
// route mounted, so the page is keyed by project: otherwise ProjectForm would
// keep the last project's fields under the new name and show unsaved changes.
function ProjectRoute() {
  const { projectId } = Route.useParams()

  return <ProjectPage key={projectId} />
}

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
        <SignInGate>Sign in to see this project.</SignInGate>
      </Page>
    )
  }

  async function remove(current: Project) {
    if (
      !(await confirm({
        title: `Delete the project “${current.name}”?`,
        message: 'Your drafts stay in Drafts.',
        confirmLabel: 'Delete project',
        isDestructive: true,
      }))
    ) {
      return
    }

    setIsDeleting(true)

    try {
      setAccountProjects(
        await deleteAccountProject({ data: { publicId: current.publicId } }),
      )
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
            setAccountProjects(
              await updateAccountProject({
                data: { ...input, publicId: project.publicId },
              }),
            )
            await router.invalidate()
            toast.success('Project saved.')
          }}
        />
      </section>
    </Page>
  )
}

const titleClass =
  'text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl'

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
} & React.ComponentProps<typeof AppPage>) {
  return (
    <AppPage {...header}>
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
    </AppPage>
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
  // The form whose permit number dialog is open.
  const [permitItem, setPermitItem] = useState<ProjectItem>()
  const [checkingUrl, setCheckingUrl] = useState<string>()
  const draftsByUrl = new Map(drafts.map((draft) => [draft.sourceUrl, draft]))

  async function removeItem(sourceUrl: string) {
    setRemovingUrl(sourceUrl)

    try {
      await removeFromAccountProject({
        data: { publicId: project.publicId, sourceUrl },
      })
      await router.invalidate()
      toast.success('Form removed from the project.')
    } catch {
      toast.error('That form couldn’t be removed. Try again.')
    } finally {
      setRemovingUrl(undefined)
    }
  }

  async function checkPermit(item: ProjectItem) {
    setCheckingUrl(item.sourceUrl)

    try {
      const { projects, check } = await checkProjectFormPermit({
        data: { publicId: project.publicId, sourceUrl: item.sourceUrl },
      })

      setAccountProjects(projects)
      await router.invalidate()

      const { tone, message } = checkToast(
        item.permit?.permitNumber ?? '',
        check,
      )

      if (tone === 'error') toast.error(message)
      else toast.success(message)
    } catch (cause) {
      toast.error(
        errorMessage(cause, 'The permit’s status couldn’t be checked.'),
      )
    } finally {
      setCheckingUrl(undefined)
    }
  }

  async function removePermit(item: ProjectItem) {
    if (
      !(await confirm({
        title: `Stop tracking permit ${item.permit?.permitNumber ?? ''}?`,
        message: 'The form stays in this project.',
        confirmLabel: 'Remove permit number',
        isDestructive: true,
      }))
    ) {
      return
    }

    try {
      setAccountProjects(
        await removeProjectFormPermit({
          data: { publicId: project.publicId, sourceUrl: item.sourceUrl },
        }),
      )
      await router.invalidate()
      toast.success(`Stopped tracking permit ${item.permit?.permitNumber}.`)
    } catch {
      toast.error('The permit number couldn’t be removed. Try again.')
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
            // Online applications are filed on the city's portal, so they
            // have no draft.
            const draft = item.online
              ? undefined
              : draftsByUrl.get(item.sourceUrl)

            const isRemoving = removingUrl === item.sourceUrl

            return (
              <li
                key={item.sourceUrl}
                className={`py-3 transition-opacity ${
                  isRemoving ? 'opacity-50' : ''
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    {draft ? (
                      <DraftName
                        publicId={draft.publicId}
                        name={draft.name}
                        formTitle={item.title}
                        className="text-ink"
                      />
                    ) : (
                      <p className="truncate text-ink">{item.title}</p>
                    )}
                    {item.online ? (
                      <OnlineApplicationMeta type={item.online} />
                    ) : (
                    <p className="truncate text-sm text-ink/60">
                      {/* Renamed drafts keep the form they're for in view. */}
                      {draft?.name && `${item.title} · `}
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
                    )}
                  </div>
                  {item.online ? (
                    <a
                      href={item.online.applyUrl ?? item.online.pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full bg-blueprint px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
                    >
                      Apply online <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
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
                  )}
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
                </div>
                <PermitSection
                  permit={item.permit}
                  isChecking={checkingUrl === item.sourceUrl}
                  onAdd={() => setPermitItem(item)}
                  onCheck={() => void checkPermit(item)}
                  onEdit={() => setPermitItem(item)}
                  onRemove={() => void removePermit(item)}
                />
              </li>
            )
          })}
        </ul>
      )}
      <PermitNumberDialog
        item={permitItem}
        project={project}
        onClose={() => setPermitItem(undefined)}
      />
    </section>
  )
}

// An online application's line under its title: the portal, whether plans
// are needed, and the city's requirements page when applying starts
// elsewhere.
function OnlineApplicationMeta({ type }: { type: PortalPermitType }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/60">
      <span className={`${badgeClass} bg-blueprint/10 text-blueprint`}>
        Online application
      </span>
      <span>{type.providerName}</span>
      {type.plansRequired && <span>· Plans required</span>}
      {/* Only when applying starts somewhere else. */}
      {type.applyUrl !== type.pageUrl && (
        <>
          <span>·</span>
          <a
            href={type.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blueprint underline-offset-2 hover:underline"
          >
            Requirements <span aria-hidden="true">↗</span>
          </a>
        </>
      )}
    </p>
  )
}

// Badge tints by phase: done reads green, stopped reads red, the rest are
// still moving.
const phaseBadgeClass: Record<PermitPhase, string> = {
  applied: 'bg-blueprint/10 text-blueprint',
  approved: 'bg-blueprint/10 text-blueprint',
  issued: 'bg-success/10 text-success',
  finaled: 'bg-success/10 text-success',
  cancelled: 'bg-redline/10 text-redline',
  expired: 'bg-redline/10 text-redline',
  unknown: 'bg-ink/10 text-ink/70',
}

const permitActionClass = `${quietActionClass} px-2 py-0.5`

// The same shape, but redline on hover: it removes the tracking.
const permitRemoveClass =
  'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-sm font-medium text-ink/75 transition hover:bg-redline/10 hover:text-redline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'

const badgeClass =
  'rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] uppercase'

// "2021-03-17" → "Mar 17, 2021". Permit dates have no time, so they're read
// in UTC; the visitor's zone would show the day before in the Americas.
function formatPermitDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const PERMIT_DATE_LABELS = [
  ['applied', 'Applied'],
  ['approved', 'Approved'],
  ['issued', 'Issued'],
  ['finaled', 'Final'],
  ['cancelled', 'Cancelled'],
  ['expires', 'Expires'],
] as const satisfies ReadonlyArray<
  readonly [keyof PermitStatus['dates'], string]
>

// The city permit filed for a form, as an indented line under it so a long
// list of forms stays short. Collapsed it shows the number and status, and a
// failed check in red; opened, the permit's dates and actions. Before a
// number is added, just the way to add one.
function PermitSection({
  permit,
  isChecking,
  onAdd,
  onCheck,
  onEdit,
  onRemove,
}: {
  permit: TrackedPermit | undefined
  isChecking: boolean
  onAdd: () => void
  onCheck: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const indentClass = 'mt-2 ml-1 border-l border-ink/20 pl-3'

  if (!permit) {
    return (
      <div className={indentClass}>
        <button
          type="button"
          className="text-sm font-medium text-blueprint underline-offset-2 hover:underline"
          onClick={onAdd}
        >
          + Add permit number
        </button>
      </div>
    )
  }

  const dates = permit.status
    ? PERMIT_DATE_LABELS.flatMap(([key, label]) => {
        const date = permit.status?.dates[key]

        return date ? [`${label} ${formatPermitDate(date)}`] : []
      })
    : []

  return (
    <details className={`group ${indentClass}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 text-sm [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          className="size-3 shrink-0 text-ink/50 transition-transform group-open:rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
        </svg>
        <span className="text-ink/60">Permit</span>
        <span className="font-mono text-ink">{permit.permitNumber}</span>
        {permit.status ? (
          <span
            className={`${badgeClass} ${phaseBadgeClass[permit.status.phase]}`}
          >
            {permit.status.label}
          </span>
        ) : (
          <span className="text-ink/60">Not checked yet</span>
        )}
        {permit.checkError ? (
          <span className="text-redline">Check failed</span>
        ) : (
          permit.checkedAt && (
            <span className="text-ink/60">
              · Checked <EditedDate iso={permit.checkedAt} />
            </span>
          )
        )}
      </summary>

      <div className="mt-2 mb-1 space-y-2 pl-5">
        {dates.length > 0 && (
          <p className="text-sm text-ink/70">{dates.join(' · ')}</p>
        )}
        {permit.checkError && (
          <Notice tone="error">{permit.checkError}</Notice>
        )}
        <div className="-ml-2 flex flex-wrap items-center">
          <button
            type="button"
            disabled={isChecking}
            className={permitActionClass}
            onClick={onCheck}
          >
            <Pending isPending={isChecking} label="Checking…">
              Check now
            </Pending>
          </button>
          <a
            href={permit.permitUrl}
            target="_blank"
            rel="noreferrer"
            className={permitActionClass}
          >
            View permit <span aria-hidden="true">↗</span>
          </a>
          <button type="button" className={permitActionClass} onClick={onEdit}>
            Edit
          </button>
          <button type="button" className={permitRemoveClass} onClick={onRemove}>
            Stop tracking
          </button>
        </div>
      </div>
    </details>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
