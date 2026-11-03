import { Link, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { SignInButton } from '#/components/SignInDialog'
import { authClient, settled } from '#/lib/auth/auth-client'
import { useAuth } from '#/lib/auth/use-auth'

// The header's sign-in pill, or the signed-in user's initial with a menu.
// withNav: the header beside it shows the inHeader links from md up, so the
// menu leaves them out there. Home has no such nav.
export function AccountMenu({ withNav = false }: { withNav?: boolean }) {
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

  if (!user) return <SignInButton />

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
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Account: ${user.name}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="grid size-8 place-items-center overflow-hidden rounded-full border border-ink bg-ink text-sm font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
        onClick={() => setIsOpen((open) => !open)}
      >
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
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-60 rounded-[2px] border border-ink bg-paper text-sm"
        >
          <div className="border-b border-ink/20 px-4 py-3">
            <p className="truncate font-medium text-ink">{user.name}</p>
            <p className="truncate text-ink/60">{user.email}</p>
          </div>
          {MENU_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
              className={`${menuItemClass} ${
                withNav && link.inHeader ? 'md:hidden' : ''
              }`}
              onClick={() => setIsOpen(false)}
            >
              <MenuIcon path={link.icon} />
              {link.label}
            </Link>
          ))}
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

// Outline icon paths on a 24px grid. inHeader links are also in SiteHeader's
// nav from md up; see withNav.
const MENU_LINKS = [
  {
    to: '/projects',
    label: 'Projects',
    inHeader: true,
    icon: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z',
  },
  {
    to: '/drafts',
    label: 'Drafts',
    inHeader: true,
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  {
    to: '/history',
    label: 'History',
    inHeader: true,
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  {
    to: '/settings',
    label: 'Settings',
    inHeader: false,
    icon: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75',
  },
] as const

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
