import { Link, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { SignInButton } from '#/components/SignInDialog'
import { authClient, settled } from '#/lib/auth/auth-client'
import { useAuth } from '#/lib/auth/use-auth'
import { CONTACT_EMAIL } from '#/lib/site'

// The signed-in user's initial with a menu of pages, settings, about and
// contact. In AppSidebar ("sidebar"), the trigger is a full row with the user's
// name, the menu opens upward, and the page links are left out, since the
// sidebar lists them. In a collapsed sidebar, the row is just the initial, and
// the menu says who's signed in instead. Signed out, it's the sign-in pill and,
// below lg, a menu of the same pages. AppSidebar has its own foot for visitors.
export function AccountMenu({
  variant = 'header',
  isCollapsed = false,
  hideVisitorMenu = false,
}: {
  variant?: 'header' | 'sidebar'
  isCollapsed?: boolean
  // In the editor, whose toolbar has little room and whose drawer has the links.
  hideVisitorMenu?: boolean
}) {
  const inSidebar = variant === 'sidebar'

  const menuLinks = inSidebar
    ? MENU_LINKS.filter((link) => !link.inSidebar)
    : MENU_LINKS

  const { user } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function closeOnOutside(event: PointerEvent) {
      if (
        !(event.target instanceof Node && menuRef.current?.contains(event.target))
      ) {
        setIsOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <SignInButton />
        {!hideVisitorMenu && (
          <div ref={menuRef} className="relative lg:hidden">
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={isOpen}
              aria-haspopup="menu"
              className="grid size-8 place-items-center rounded-full border border-ink/35 text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
              onClick={() => setIsOpen((open) => !open)}
            >
              <MenuIcon path={MENU_ICON} className="text-ink" />
            </button>
            {isOpen && (
              <div
                role="menu"
                className="absolute top-full right-0 z-50 mt-2 w-60 rounded-xs border border-ink bg-paper text-sm"
              >
                {MENU_LINKS.flatMap((link) =>
                  link.to === '/settings'
                    ? []
                    : [
                        <Link
                          key={link.to}
                          to={link.to}
                          role="menuitem"
                          className={menuItemClass}
                          onClick={() => setIsOpen(false)}
                        >
                          <MenuIcon path={link.icon} />
                          {link.to === '/' ? 'Home' : link.label}
                        </Link>,
                      ],
                )}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => setIsOpen(false)}
                >
                  <MenuIcon path={CONTACT_ICON} />
                  Contact us
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  async function signOut() {
    setIsBusy(true)
    const { error } = await settled(authClient.signOut())
    setIsBusy(false)

    if (error) {
      toast.error('You couldn’t be signed out. Try again.')

      return
    }

    setIsOpen(false)
    await router.invalidate()
  }

  return (
    <div
      ref={menuRef}
      className={`relative shrink-0 ${inSidebar ? 'w-full' : ''}`}
    >
      <button
        type="button"
        aria-label={`Account: ${user.name}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={
          inSidebar
            ? `group/account flex h-16 w-full items-center transition hover:bg-ink/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blueprint ${isCollapsed ? 'justify-center' : 'gap-3 px-8 text-left'} ${isOpen ? 'bg-ink/5' : ''}`
            : 'rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'
        }
        title={isCollapsed ? user.name : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-ink bg-ink text-sm font-medium text-paper">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            (user.name || user.email).charAt(0).toUpperCase()
          )}
        </span>
        {inSidebar && !isCollapsed && (
          <span className="min-w-0 flex-1 text-sm leading-5">
            <span className="block truncate font-medium text-ink">
              {user.name}
            </span>
            <span className="block truncate text-ink/60">{user.email}</span>
          </span>
        )}
        {/* Marks the row as a menu: it opens upward with more inside. */}
        {inSidebar && !isCollapsed && (
          <svg
            aria-hidden="true"
            className="size-4 shrink-0 text-ink/50 transition group-hover/account:text-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 w-60 rounded-xs border border-ink bg-paper text-sm ${
            inSidebar
              ? `bottom-full mb-2 ${isCollapsed ? 'left-4' : 'left-8'}`
              : 'top-full right-0 mt-2'
          }`}
        >
          {/* The full sidebar's trigger already shows who's signed in. */}
          {(!inSidebar || isCollapsed) && (
            <div className="border-b border-ink/20 px-4 py-3">
              <p className="truncate font-medium text-ink">{user.name}</p>
              <p className="truncate text-ink/60">{user.email}</p>
            </div>
          )}
          {menuLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
              className={menuItemClass}
              onClick={() => setIsOpen(false)}
            >
              <MenuIcon path={link.icon} />
              {link.label}
            </Link>
          ))}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            role="menuitem"
            className={menuItemClass}
            onClick={() => setIsOpen(false)}
          >
            <MenuIcon path={CONTACT_ICON} />
            Contact us
          </a>
          <button
            type="button"
            role="menuitem"
            disabled={isBusy}
            className="group flex w-full items-center gap-3 border-t border-ink/20 px-4 py-2.5 text-left text-ink transition hover:bg-redline/10 hover:text-redline focus-visible:bg-redline/10 focus-visible:text-redline disabled:opacity-50"
            onClick={() => void signOut()}
          >
            <MenuIcon
              path={SIGN_OUT_ICON}
              className="group-hover:text-redline group-focus-visible:text-redline"
            />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const menuItemClass =
  'flex items-center gap-3 px-4 py-2.5 text-ink transition hover:bg-ink/5'

export const ABOUT_ICON =
  'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z'

// Outline icon paths on a 24px grid. inSidebar links are also in AppSidebar,
// so its menu leaves them out.
const MENU_LINKS = [
  {
    to: '/',
    label: 'Dashboard',
    inSidebar: true,
    icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  },
  {
    to: '/history',
    label: 'History',
    inSidebar: true,
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  {
    to: '/permits',
    label: 'My permits',
    inSidebar: true,
    icon: 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z',
  },
  {
    to: '/projects',
    label: 'Projects',
    inSidebar: true,
    icon: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  },
  {
    to: '/drafts',
    label: 'Drafts',
    inSidebar: true,
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  {
    to: '/settings',
    label: 'Settings',
    inSidebar: false,
    icon: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75',
  },
  {
    to: '/about',
    label: 'About',
    inSidebar: false,
    icon: ABOUT_ICON,
  },
] as const

const MENU_ICON = 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'

export const CONTACT_ICON =
  'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75'

const SIGN_OUT_ICON =
  'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9'

function MenuIcon({
  path,
  className = '',
}: {
  path: string
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 shrink-0 text-ink/60 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}
