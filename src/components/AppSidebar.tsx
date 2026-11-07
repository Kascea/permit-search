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

import {
  ABOUT_ICON,
  AccountMenu,
  CONTACT_ICON,
} from '#/components/AccountMenu'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SignInButton } from '#/components/SignInDialog'
import { useAuth } from '#/lib/auth/use-auth'
import { useSidebarCollapsed } from '#/lib/navigation/sidebar'
import { deleteAccountProject } from '#/lib/projects/projects'
import {
  setAccountProjects,
  useAccountProjects,
} from '#/lib/projects/use-account-projects'
import { CONTACT_EMAIL } from '#/lib/site'
import { confirm } from '#/components/ConfirmDialog'

// How many recent projects the sidebar lists under Projects.
const RECENT_PROJECT_COUNT = 5

// Outline icon paths on a 24px grid, as in AccountMenu. Visitors see the same
// rows; accountOnly ones are marked with a lock and open a page that explains
// them and asks them to sign in.
const SECTIONS = [
  {
    to: '/',
    label: 'Dashboard',
    accountOnly: false,
    icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  },
  {
    to: '/history',
    label: 'History',
    accountOnly: true,
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  {
    to: '/permits',
    label: 'My permits',
    accountOnly: true,
    icon: 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z',
  },
  {
    to: '/projects',
    label: 'Projects',
    accountOnly: true,
    icon: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  },
  {
    to: '/drafts',
    label: 'Drafts',
    accountOnly: false,
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
] as const

// The sidebar sits on the page grid (one cell is 2rem): it's 8 cells wide,
// every row is one cell tall, icons start one cell in and labels two. Its
// right rule (rule-r) lands on a grid line.
const rowClass = 'flex h-8 items-center gap-4 px-8 text-sm transition'

// Collapsed, it's 2 cells wide, with each row's icon centered.
const collapsedRowClass = 'flex h-8 items-center justify-center text-sm transition'

const inactiveRowClass = 'text-ink/90 hover:bg-ink/5 hover:text-ink'

const activeRowClass = 'bg-blueprint/10 font-medium text-blueprint'

// A list tied to the row above it by a faint margin rule under that row's
// icon; its rows put their labels in the label column.
const ruledListClass =
  'relative before:absolute before:inset-y-0 before:left-10 before:w-px before:bg-ink/20'

const ruledRowClass =
  'relative flex h-8 items-center gap-2 pr-8 pl-16 text-sm transition'

// The sidebar's logo, two cells tall with its rule at the foot, so the rule
// runs on into the top bar's beside it. The editor's file panel uses it too.
export function SidebarBrand({ isCollapsed = false }: { isCollapsed?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="Permit Search home"
      className={`flex h-16 shrink-0 items-center text-ink rule-b ${
        isCollapsed ? 'justify-center' : 'gap-3 px-8'
      }`}
    >
      <PermitSearchLogo className="size-8" />
      {!isCollapsed && (
        <span className="text-sm font-medium tracking-tight">
          Permit Search
        </span>
      )}
    </Link>
  )
}

// Shrinks the sidebar to its icons or brings it back. It's the row above
// Dashboard both ways, so the pointer is still on it to undo. The editor's file
// panel uses it too, with its own rows' look while expanded.
export function SidebarToggle({
  expandedClassName = `${rowClass} ${inactiveRowClass}`,
}: {
  expandedClassName?: string
}) {
  const { isCollapsed, setIsCollapsed } = useSidebarCollapsed()

  return (
    <button
      type="button"
      aria-expanded={!isCollapsed}
      title={isCollapsed ? 'Expand sidebar' : undefined}
      className={`mb-8 w-full ${
        isCollapsed
          ? `${collapsedRowClass} ${inactiveRowClass}`
          : expandedClassName
      }`}
      onClick={() => setIsCollapsed(!isCollapsed)}
    >
      <SidebarIcon
        path={
          isCollapsed
            ? 'm5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5'
            : 'm18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5'
        }
      />
      {/* Sized here because buttons take their font from styles.css. */}
      <span className={isCollapsed ? 'sr-only' : 'text-sm'}>
        {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </span>
    </button>
  )
}

// Marks the current row of a ruled list: a short blueprint bar on the rule.
function RuleMarker() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-1.5 left-10 w-0.75 -translate-x-1/2 bg-blueprint"
    />
  )
}

// The app's navigation and account, beside every page from lg up, for visitors
// too: signing in fills it in rather than moving anything. SiteHeader's top bar
// beside it holds search; below lg the header's account menu holds these links.
// It's see-through, so the page's grid runs under it.
export function AppSidebar() {
  const { user } = useAuth()
  const { projects } = useAccountProjects(Boolean(user))
  const recentProjects = projects?.slice(0, RECENT_PROJECT_COUNT) ?? []
  const { isCollapsed } = useSidebarCollapsed()

  // Above the page, since its menus open out over it.
  return (
    <aside
      className={`sticky top-0 z-50 hidden h-screen shrink-0 flex-col rule-r lg:flex ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <SidebarBrand isCollapsed={isCollapsed} />

      {/* A cell down, so the first row starts a cell below the rule. */}
      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-8"
      >
        <SidebarToggle />
        <ul>
          {SECTIONS.map((section) => (
            <li key={section.to}>
              {section.to === '/projects' ? (
                <ProjectsGroup
                  icon={section.icon}
                  projects={recentProjects}
                  isCollapsed={isCollapsed}
                  isLocked={!user}
                />
              ) : (
                <Link
                  to={section.to}
                  title={
                    isCollapsed ? sectionLabel(section, !user) : undefined
                  }
                  className={isCollapsed ? collapsedRowClass : rowClass}
                  activeOptions={{ exact: section.to === '/' }}
                  activeProps={{ className: activeRowClass }}
                  inactiveProps={{ className: inactiveRowClass }}
                >
                  <SidebarIcon path={section.icon} />
                  <span className={isCollapsed ? 'sr-only' : undefined}>
                    {sectionLabel(section, !user)}
                  </span>
                  {!user && section.accountOnly && !isCollapsed && <LockMark />}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 pt-8">
        {user ? (
          // Settings, About and Contact us are in its menu.
          <AccountMenu variant="sidebar" isCollapsed={isCollapsed} />
        ) : (
          <VisitorFoot isCollapsed={isCollapsed} />
        )}
      </div>
    </aside>
  )
}

// Without an account there's no dashboard; the same row goes to the home page.
function sectionLabel(section: (typeof SECTIONS)[number], isVisitor: boolean) {
  return isVisitor && section.to === '/' ? 'Home' : section.label
}

// Marks a row that needs an account, at the row's end.
function LockMark() {
  return (
    <span
      className="ml-auto text-ink/40"
      title="Sign in to use this"
    >
      <SidebarIcon path="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      <span className="sr-only">Sign in to use this</span>
    </span>
  )
}

// Where a signed-in user's account row sits, for visitors: what its menu would
// hold, and the way in.
function VisitorFoot({ isCollapsed }: { isCollapsed: boolean }) {
  const row = isCollapsed ? collapsedRowClass : rowClass

  return (
    <>
      <Link
        to="/about"
        title={isCollapsed ? 'About' : undefined}
        className={row}
        activeProps={{ className: activeRowClass }}
        inactiveProps={{ className: inactiveRowClass }}
      >
        <SidebarIcon path={ABOUT_ICON} />
        <span className={isCollapsed ? 'sr-only' : undefined}>About</span>
      </Link>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        title={isCollapsed ? 'Contact us' : undefined}
        className={`${row} ${inactiveRowClass}`}
      >
        <SidebarIcon path={CONTACT_ICON} />
        <span className={isCollapsed ? 'sr-only' : undefined}>Contact us</span>
      </a>
      <div
        className={`flex h-16 items-center ${
          isCollapsed ? 'justify-center' : 'px-8'
        }`}
      >
        {isCollapsed ? (
          <SignInButton
            ariaLabel="Sign in"
            title="Sign in"
            className="grid size-8 place-items-center rounded-full bg-blueprint text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
          >
            <SidebarIcon path="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </SignInButton>
        ) : (
          <SignInButton className="w-full rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint" />
        )}
      </div>
    </>
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
// project's page highlights just that project. Collapsed, the list is hidden,
// so the row lights up on every project page instead.
function ProjectsGroup({
  icon,
  projects,
  isCollapsed,
  isLocked,
}: {
  icon: string
  projects: Array<{ publicId: string; name: string }>
  isCollapsed: boolean
  // Signed out: the row just opens the page, which asks them to sign in.
  isLocked: boolean
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

  const hasList = !isCollapsed && projects.length > 0
  const isOpen = isStoredOpen && hasList

  return (
    <>
      <div
        className="relative"
        onContextMenu={(event) => {
          if (isLocked) return

          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <Link
          to="/projects"
          title={
            isCollapsed
              ? 'Projects'
              : isLocked
                ? undefined
                : 'Right-click for New project'
          }
          className={
            isCollapsed
              ? collapsedRowClass
              : isLocked
                ? rowClass
                : `${rowClass} pr-16`
          }
          activeOptions={{ exact: !isCollapsed }}
          activeProps={{ className: activeRowClass }}
          inactiveProps={{ className: inactiveRowClass }}
        >
          <SidebarIcon path={icon} />
          <span className={isCollapsed ? 'sr-only' : undefined}>Projects</span>
          {isLocked && !isCollapsed && <LockMark />}
        </Link>
        {hasList && (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-label={isOpen ? 'Hide recent projects' : 'Show recent projects'}
            className="absolute top-1 right-8 grid size-6 place-items-center rounded-full text-ink/80 transition hover:bg-ink/10 hover:text-ink"
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
        <ul id={listId} aria-label="Recent projects" className={ruledListClass}>
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
                className={ruledRowClass}
                activeProps={{ className: 'font-medium text-blueprint' }}
                inactiveProps={{ className: inactiveRowClass }}
              >
                {({ isActive }) => (
                  <>
                    {isActive && <RuleMarker />}
                    <span className="truncate">{project.name}</span>
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
      !(await confirm({
        title: `Delete the project “${target.name}”?`,
        message: 'Your drafts stay in Drafts.',
        confirmLabel: 'Delete project',
        isDestructive: true,
      }))
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
      className="fixed z-50 w-48 rounded-xs border border-ink bg-paper py-1"
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
