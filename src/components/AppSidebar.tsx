import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { toast } from 'sonner'

import { AccountMenu } from '#/components/AccountMenu'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { deleteAccountProject } from '#/lib/projects/projects'
import {
  setAccountProjects,
  useAccountProjects,
} from '#/lib/projects/use-account-projects'

// How many recent projects the sidebar lists under Projects.
const RECENT_PROJECT_COUNT = 5

// Outline icon paths on a 24px grid, as in AccountMenu.
const SECTIONS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  },
  {
    to: '/history',
    label: 'History',
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  },
  {
    to: '/drafts',
    label: 'Drafts',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
] as const

// The sidebar sits on the page's 32px grid: it's 8 cells wide, every row is
// one cell tall and starts on a line, icons start one cell in and labels two.
// Its right edge is the content column's border, which lands on a grid line
// (see AppLayout).
const rowClass = 'flex h-8 items-center gap-4 px-8 text-sm transition'

const inactiveRowClass = 'text-ink/70 hover:bg-ink/5 hover:text-ink'

const activeRowClass = 'bg-blueprint/10 font-medium text-blueprint'

// The signed-in app's navigation and account, beside every page from lg up.
// SiteHeader's top bar beside it holds search; below lg the header's account
// menu holds these links. It's see-through, so the page's grid runs under it.
export function AppSidebar() {
  const { projects } = useAccountProjects(true)
  const recentProjects = projects?.slice(0, RECENT_PROJECT_COUNT) ?? []

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col lg:flex">
      {/* 65px, so its bottom rule lands on the grid line two cells down and
          runs on into SiteHeader's. */}
      <Link
        to="/"
        aria-label="Permit Search home"
        className="flex h-[65px] shrink-0 items-center gap-3 border-b border-ink px-8 text-ink"
      >
        <PermitSearchLogo className="size-8" />
        <span className="text-sm font-medium tracking-tight">
          Permit Search
        </span>
      </Link>

      {/* 31px down, so the first row starts on the next grid line. */}
      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[31px]"
      >
        <ul>
          {SECTIONS.map((section) => (
            <li key={section.to}>
              {section.to === '/projects' ? (
                <ProjectsGroup icon={section.icon} projects={recentProjects} />
              ) : (
                <Link
                  to={section.to}
                  className={rowClass}
                  activeOptions={{ exact: section.to === '/' }}
                  activeProps={{ className: activeRowClass }}
                  inactiveProps={{ className: inactiveRowClass }}
                >
                  <SidebarIcon path={section.icon} />
                  {section.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Settings, About and Contact us are in its menu. */}
      <div className="shrink-0 pt-8">
        <AccountMenu variant="sidebar" />
      </div>
    </aside>
  )
}

// Whether the sidebar's project list is open, kept in this browser. Storage
// can be blocked, so it falls back to open; the server always renders open.
const PROJECTS_OPEN_KEY = 'permit-search:sidebar-projects-open'
const projectsOpenListeners = new Set<() => void>()

function readProjectsOpen() {
  try {
    return localStorage.getItem(PROJECTS_OPEN_KEY) !== 'false'
  } catch {
    return true
  }
}

function writeProjectsOpen(isOpen: boolean) {
  try {
    localStorage.setItem(PROJECTS_OPEN_KEY, String(isOpen))
  } catch {
    // Still toggles for this page view; it just isn't remembered.
  }

  for (const listener of projectsOpenListeners) listener()
}

function subscribeProjectsOpen(listener: () => void) {
  projectsOpenListeners.add(listener)

  return () => projectsOpenListeners.delete(listener)
}

// Projects, with a caret at the row's end to fold its list, then the recent
// projects along a margin rule. Right-click (or the keyboard's
// menu key) opens SidebarMenu: on the row for New project, on a project to
// open or delete it. Only the list page lights up the Projects row, so a
// project's page highlights just that project.
function ProjectsGroup({
  icon,
  projects,
}: {
  icon: string
  projects: Array<{ publicId: string; name: string }>
}) {
  const listId = useId()
  const [menu, setMenu] = useState<SidebarMenuState>()
  const closeMenu = useCallback(() => setMenu(undefined), [])

  const isStoredOpen = useSyncExternalStore(
    subscribeProjectsOpen,
    readProjectsOpen,
    () => true,
  )

  // Opening one of the projects opens the list, so it shows as current.
  const projectPath = useRouterState({
    select: (state) => {
      const path = state.location.pathname

      return path.startsWith('/projects/') && path !== '/projects/new'
        ? path
        : undefined
    },
  })

  useEffect(() => {
    if (projectPath && !readProjectsOpen()) writeProjectsOpen(true)
  }, [projectPath])

  const isOpen = isStoredOpen && projects.length > 0

  return (
    <>
      <div
        className="relative"
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <Link
          to="/projects"
          title="Right-click for New project"
          className={`${rowClass} pr-16`}
          activeOptions={{ exact: true }}
          activeProps={{ className: activeRowClass }}
          inactiveProps={{ className: inactiveRowClass }}
        >
          <SidebarIcon path={icon} />
          Projects
        </Link>
        {projects.length > 0 && (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-label={isOpen ? 'Hide recent projects' : 'Show recent projects'}
            className="absolute top-1 right-8 grid size-6 place-items-center rounded-full text-ink/60 transition hover:bg-ink/10 hover:text-ink"
            onClick={() => writeProjectsOpen(!isOpen)}
          >
            <svg
              aria-hidden="true"
              className={`size-3.5 transition-transform ${
                isOpen ? '' : '-rotate-90'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
        )}
      </div>

      {menu && <SidebarMenu menu={menu} onClose={closeMenu} />}

      {isOpen && (
        // One faint margin rule under the Projects icon (x 40) ties the list
        // to it; the current project marks the rule in blueprint.
        <ul
          id={listId}
          aria-label="Recent projects"
          className="relative before:absolute before:inset-y-0 before:left-10 before:w-px before:bg-ink/20"
        >
          {projects.map((project) => (
            <li
              key={project.publicId}
              onContextMenu={(event) => {
                event.preventDefault()
                setMenu({ x: event.clientX, y: event.clientY, project })
              }}
            >
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.publicId }}
                className="relative block h-8 truncate pr-8 pl-16 text-sm leading-8 transition"
                activeProps={{ className: 'font-medium text-blueprint' }}
                inactiveProps={{ className: inactiveRowClass }}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1.5 left-[39px] w-[3px] bg-blueprint"
                      />
                    )}
                    {project.name}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// Where a right-click opened the menu, and on which project, if any.
interface SidebarMenuState {
  x: number
  y: number
  project?: { publicId: string; name: string }
}

const menuItemClass =
  'flex w-full items-center px-4 py-2 text-left text-sm text-ink transition hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none'

// The right-click menu, at the pointer. Closes on a choice, a click
// elsewhere, Escape, or scrolling.
function SidebarMenu({
  menu,
  onClose,
}: {
  menu: SidebarMenuState
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const router = useRouter()
  const { project } = menu

  const currentPath = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    function closeOnOutside(event: PointerEvent) {
      if (
        !(event.target instanceof Node && menuRef.current?.contains(event.target))
      ) {
        onClose()
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', onClose, true)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  // As on the project's page: asks first, and drafts are kept. The menu
  // closes first, so the confirm and toast stand alone.
  async function remove(target: { publicId: string; name: string }) {
    onClose()

    if (
      !window.confirm(
        `Delete the project “${target.name}”? Your drafts stay in Drafts.`,
      )
    ) {
      return
    }

    try {
      setAccountProjects(
        await deleteAccountProject({ data: { publicId: target.publicId } }),
      )
      toast.success('Project deleted.')

      if (currentPath === `/projects/${target.publicId}`) {
        await navigate({ to: '/projects' })
      }

      // Pages such as the dashboard list it too.
      await router.invalidate()
    } catch {
      toast.error('The project couldn’t be deleted. Try again.')
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={project ? project.name : 'Projects'}
      className="fixed z-50 w-48 rounded-[2px] border border-ink bg-paper py-1"
      style={{ left: menu.x, top: menu.y }}
    >
      {project ? (
        <>
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.publicId }}
            role="menuitem"
            className={menuItemClass}
            onClick={onClose}
          >
            Open
          </Link>
          <button
            type="button"
            role="menuitem"
            className={`${menuItemClass} border-t border-ink/20 hover:bg-redline/10 hover:text-redline focus-visible:bg-redline/10 focus-visible:text-redline`}
            onClick={() => void remove(project)}
          >
            Delete project
          </button>
        </>
      ) : (
        <>
          <Link
            to="/projects/new"
            role="menuitem"
            className={menuItemClass}
            onClick={onClose}
          >
            New project
          </Link>
          <Link
            to="/projects"
            role="menuitem"
            className={menuItemClass}
            onClick={onClose}
          >
            All projects
          </Link>
        </>
      )}
    </div>
  )
}

function SidebarIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}
