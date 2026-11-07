import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { SidebarToggle } from '#/components/AppSidebar'
import { SignInButton } from '#/components/SignInDialog'
import { listAccountDrafts } from '#/lib/drafts/drafts'
import { listLocalDrafts } from '#/lib/drafts/local'
import { draftKey, draftTitle } from '#/lib/drafts/types'
import { originParam } from '#/lib/navigation/origin'
import { useSidebarCollapsed } from '#/lib/navigation/sidebar'
import { useAccountProjects } from '#/lib/projects/use-account-projects'

interface SidebarDraft {
  sourceUrl: string
  // The project whose copy of the form this is; see DraftSummary.
  projectId?: string
  title: string
  // The user's name for it, from the account; see DraftSummary.
  name?: string
  updatedAt: string
}

// Kept between editor visits so switching forms doesn't flash an empty list.
let cachedDrafts: Array<SidebarDraft> | undefined

// Folders the user opened or closed, by key, so opening another PDF never
// undoes it. Shared by the desktop and phone sidebars, and kept when the
// sidebar remounts.
const folderChoices = new Map<string, boolean>()

// The account's drafts plus any in this browser that haven't synced yet;
// only this browser's when signed out.
async function loadDrafts(signedIn: boolean): Promise<Array<SidebarDraft>> {
  const local: Array<SidebarDraft> = listLocalDrafts().map((draft) => ({
    sourceUrl: draft.sourceUrl,
    projectId: draft.projectId,
    title: draftTitle(draft.sourceUrl),
    updatedAt: draft.updatedAt,
  }))

  const account = signedIn ? ((await listAccountDrafts()) ?? []) : []

  const byForm = new Map<string, SidebarDraft>()

  for (const draft of [...account, ...local]) {
    const key = draftKey(draft.sourceUrl, draft.projectId)
    const existing = byForm.get(key)

    if (!existing || existing.updatedAt < draft.updatedAt) {
      // A newer copy in this browser keeps the account's name for it.
      byForm.set(key, {
        ...draft,
        name: draft.name ?? existing?.name,
      })
    }
  }

  return [...byForm.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

interface DraftSidebarProps {
  currentUrl: string
  // The project whose copy of the open PDF this is, if any.
  currentProjectId: string | undefined
  signedIn: boolean
  // Changes when the current draft saves, so the list picks it up.
  refreshKey: string
  onNavigate?: () => void
  // Just the folders' icons; see CollapsedFiles.
  isCollapsed?: boolean
  // Shows SidebarToggle: on the desktop panel, not in the phone drawer.
  canCollapse?: boolean
}

export function DraftSidebar({
  currentUrl,
  currentProjectId,
  signedIn,
  refreshKey,
  onNavigate,
  isCollapsed = false,
  canCollapse = false,
}: DraftSidebarProps) {
  const [drafts, setDrafts] = useState(cachedDrafts)
  const [error, setError] = useState(false)
  // Loads alongside the drafts request.
  const { projects, error: projectsError } = useAccountProjects(signedIn)

  useEffect(() => {
    let cancelled = false
    loadDrafts(signedIn)
      .then((loaded) => {
        cachedDrafts = loaded

        if (!cancelled) {
          setDrafts(loaded)
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [signedIn, refreshKey])

  const draftsByForm = new Map(
    drafts?.map((draft) => [draftKey(draft.sourceUrl, draft.projectId), draft]),
  )

  // The editor fills PDFs, so online applications in a project aren't
  // listed here; they're on the project page.
  const pdfProjects = projects?.map((project) => ({
    ...project,
    items: project.items.filter(({ kind }) => kind !== 'online'),
  }))

  // A project's copies are listed there, so drafts only lists the rest. A
  // project's copy that the sidebar hasn't heard of yet stays out of both.
  const otherDrafts = drafts?.filter(({ projectId }) => !projectId)

  const hasProjects = projects !== undefined && projects.length > 0

  // Whether this project holds the open copy of the PDF.
  const holdsOpenForm = (project: { publicId: string }) =>
    project.publicId === currentProjectId

  if (isCollapsed) {
    return (
      <CollapsedFiles
        signedIn={signedIn}
        folders={[
          ...(signedIn && pdfProjects ? pdfProjects : []).map((project) => ({
            key: `project:${project.publicId}`,
            name: project.name,
            holdsCurrent: holdsOpenForm(project),
          })),
          {
            key: 'drafts',
            name: hasProjects ? 'Drafts' : 'Your drafts',
            holdsCurrent:
              !currentProjectId &&
              (otherDrafts?.some(({ sourceUrl }) => sourceUrl === currentUrl) ??
                false),
          },
        ]}
      />
    )
  }

  return (
    <nav
      aria-label="Your projects and drafts"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {canCollapse && <SidebarToggle expandedClassName={topRowClass} />}
        <Link to={signedIn ? '/dashboard' : '/'} className={topRowClass}>
          <Glyph path="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          {signedIn ? 'Dashboard' : 'Home'}
        </Link>

        <div className="mt-3 flex h-8 items-center justify-between px-4">
          <h2 className="text-xs font-medium tracking-[0.16em] text-ink/60 uppercase">
            Files
          </h2>
          {signedIn && (
            <Link to="/projects" className={manageLinkClass}>
              Projects
            </Link>
          )}
        </div>

        {/* Projects are folders of PDFs; forms outside a project are in
            Drafts. The folder with the open PDF starts open, or the most
            recent project when the PDF isn't in one. After that, folders
            stay as the user left them. */}
        <ul role="tree" aria-label="Files">
          {signedIn &&
            (pdfProjects === undefined ? (
              <li className={noteClass}>
                {projectsError ? 'Projects couldn’t be loaded.' : 'Loading…'}
              </li>
            ) : pdfProjects.length === 0 ? (
              <li className={noteClass}>
                Save your property and contact details in a project to fill out
                forms faster.{' '}
                <Link
                  to="/projects/new"
                  className="font-medium text-blueprint underline-offset-2 hover:underline"
                >
                  Start a project
                </Link>
              </li>
            ) : (
              pdfProjects.map((project, index) => (
                <Folder
                  key={project.publicId}
                  folderKey={`project:${project.publicId}`}
                  name={project.name}
                  detail={
                    project.city
                      ? `${project.city.name}, ${project.city.region}`
                      : undefined
                  }
                  count={project.items.length}
                  holdsCurrent={holdsOpenForm(project)}
                  startsOpen={index === 0 && !currentProjectId}
                >
                  {project.items.map((item) => {
                    const draft = draftsByForm.get(
                      draftKey(item.sourceUrl, project.publicId),
                    )

                    return (
                    <FileLink
                      key={item.sourceUrl}
                      sourceUrl={item.sourceUrl}
                      title={draft?.name ?? item.title}
                      editedAt={draft?.updatedAt}
                      isCurrent={
                        item.sourceUrl === currentUrl && holdsOpenForm(project)
                      }
                      from={originParam({
                        kind: 'project',
                        id: project.publicId,
                      })}
                      onNavigate={onNavigate}
                    />
                    )
                  })}
                </Folder>
              ))
            ))}

          <Folder
            folderKey="drafts"
            name={hasProjects ? 'Drafts' : 'Your drafts'}
            detail="Forms not in a project"
            count={otherDrafts?.length}
            holdsCurrent={false}
            startsOpen
          >
            {otherDrafts === undefined ? (
              <li className={`${noteClass} pl-12`}>
                {error ? 'Drafts couldn’t be loaded.' : 'Loading…'}
              </li>
            ) : (
              otherDrafts.map((draft) => (
                <FileLink
                  key={draft.sourceUrl}
                  sourceUrl={draft.sourceUrl}
                  title={draft.name ?? draft.title}
                  editedAt={draft.updatedAt}
                  isCurrent={
                    !currentProjectId && draft.sourceUrl === currentUrl
                  }
                  from="drafts"
                  onNavigate={onNavigate}
                />
              ))
            )}
          </Folder>
        </ul>
      </div>

      {!signedIn && (
        <div className="shrink-0 px-4 py-4 text-sm leading-6 text-ink/70">
          These drafts are saved on this device only.
          <SignInButton className="mt-2 block font-medium text-blueprint underline-offset-2 hover:underline">
            Sign in to keep them and use projects
          </SignInButton>
        </div>
      )}
    </nav>
  )
}

const topRowClass =
  'flex h-8 items-center gap-2 px-4 text-sm text-ink/70 transition hover:text-ink'

const manageLinkClass =
  'text-xs font-medium text-blueprint underline-offset-2 hover:underline'

const noteClass = 'px-4 py-1.5 text-xs leading-5 text-ink/60'

// Outline paths on a 24px grid.
const FOLDER_ICON =
  'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z'

const FOLDER_OPEN_ICON =
  'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776'

const FILE_ICON =
  'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'

const COLLAPSED_ROW_CLASS =
  'flex h-8 w-full items-center justify-center transition'

// The collapsed sidebar: the way back, then a folder icon for each project and
// for drafts, with the open PDF's folder selected. Files need their names, so
// choosing a folder brings the sidebar back with that folder open.
function CollapsedFiles({
  signedIn,
  folders,
}: {
  signedIn: boolean
  folders: Array<{ key: string; name: string; holdsCurrent: boolean }>
}) {
  const { setIsCollapsed } = useSidebarCollapsed()
  const backLabel = signedIn ? 'Dashboard' : 'Home'

  return (
    <nav
      aria-label="Your projects and drafts"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3"
    >
      <SidebarToggle />
      <Link
        to={signedIn ? '/dashboard' : '/'}
        title={backLabel}
        className={`${COLLAPSED_ROW_CLASS} text-ink/70 hover:text-ink`}
      >
        <Glyph path="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        <span className="sr-only">{backLabel}</span>
      </Link>

      <ul aria-label="Files" className="mt-3">
        {folders.map((folder) => (
          <li key={folder.key}>
            <button
              type="button"
              title={folder.name}
              aria-current={folder.holdsCurrent ? 'true' : undefined}
              className={`${COLLAPSED_ROW_CLASS} ${
                folder.holdsCurrent
                  ? 'bg-blueprint/10 text-blueprint'
                  : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
              }`}
              onClick={() => {
                folderChoices.set(folder.key, true)
                setIsCollapsed(false)
              }}
            >
              <Glyph path={FOLDER_ICON} />
              <span className="sr-only">{`Open ${folder.name}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// A folder that opens and closes like a file browser's: caret, folder icon
// (open or closed), name, and how many files it holds. Its files are indented
// one level, with a faint guide under the folder icon.
//
// It opens when the open PDF moves into it, but never closes by itself: the
// user's own open or close (folderChoices) wins until they change it.
function Folder({
  folderKey,
  name,
  detail,
  count,
  holdsCurrent,
  startsOpen,
  children,
}: {
  // Names the folder in folderChoices, such as "project:abc123".
  folderKey: string
  name: string
  // In the tooltip, such as the project's city.
  detail?: string
  count?: number
  // Whether the open PDF is in this folder.
  holdsCurrent: boolean
  // Open the first time it's shown even without the open PDF.
  startsOpen: boolean
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(
    () => folderChoices.get(folderKey) ?? (holdsCurrent || startsOpen),
  )

  const [heldCurrent, setHeldCurrent] = useState(holdsCurrent)

  // The open PDF just moved into this folder: show it.
  if (holdsCurrent !== heldCurrent) {
    setHeldCurrent(holdsCurrent)

    if (holdsCurrent && !isOpen) {
      folderChoices.delete(folderKey)
      setIsOpen(true)
    }
  }

  return (
    <li role="treeitem" aria-expanded={isOpen} aria-selected={false}>
      <details
        className="group/folder"
        open={isOpen}
        onToggle={(event) => {
          const { open } = event.currentTarget

          if (open === isOpen) return

          folderChoices.set(folderKey, open)
          setIsOpen(open)
        }}
      >
        <summary
          className="flex h-7 cursor-pointer list-none items-center gap-1.5 pr-4 pl-2 text-sm text-ink transition hover:bg-ink/5 [&::-webkit-details-marker]:hidden"
          title={detail ? `${name} · ${detail}` : name}
        >
          <span className="text-ink/50 transition group-open/folder:rotate-90">
            <Glyph path="m9 18 6-6-6-6" small />
          </span>
          <span className="text-ink/60 group-open/folder:hidden">
            <Glyph path={FOLDER_ICON} />
          </span>
          <span className="hidden text-ink/60 group-open/folder:block">
            <Glyph path={FOLDER_OPEN_ICON} />
          </span>
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {count !== undefined && (
            <span className="shrink-0 text-xs text-ink/40 tabular-nums">
              {count}
            </span>
          )}
        </summary>
        <ul
          role="group"
          className="relative before:absolute before:inset-y-0 before:left-9 before:w-px before:bg-ink/15"
        >
          {count === 0 ? (
            <li className={`${noteClass} pl-12 italic`}>Empty</li>
          ) : (
            children
          )}
        </ul>
      </details>
    </li>
  )
}

// A PDF in a folder: the file icon in the PDF badge's red, its title, and
// when it was last edited if it has a draft. The open one is selected, as in
// a file browser; the full title and site are in its tooltip.
function FileLink({
  sourceUrl,
  title,
  editedAt,
  isCurrent,
  from,
  onNavigate,
}: {
  sourceUrl: string
  title: string
  editedAt?: string
  isCurrent: boolean
  // The editor's breadcrumb origin; see Origin.
  from: string
  onNavigate?: () => void
}) {
  return (
    <li role="treeitem" aria-selected={isCurrent}>
      <Link
        to="/editor"
        search={{ url: sourceUrl, from }}
        aria-current={isCurrent ? 'page' : undefined}
        title={`${title} · ${hostname(sourceUrl)}`}
        onClick={onNavigate}
        className={`flex h-7 items-center gap-1.5 pr-4 pl-12 text-sm transition ${
          isCurrent
            ? 'bg-blueprint/10 font-medium text-blueprint'
            : 'text-ink/80 hover:bg-ink/5 hover:text-ink'
        }`}
      >
        <span className={isCurrent ? 'text-blueprint' : 'text-redline/70'}>
          <Glyph path={FILE_ICON} />
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {editedAt && (
          <span className="shrink-0 text-xs font-normal text-ink/40">
            {timeAgo(editedAt)}
          </span>
        )}
      </Link>
    </li>
  )
}

function Glyph({ path, small = false }: { path: string; small?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`${small ? 'size-3.5' : 'size-4'} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// "Just now", "5 min ago", "3 hr ago", or a date.
function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)

  if (minutes < 1) return 'Just now'

  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)

  if (hours < 24) return `${hours} hr ago`

  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
