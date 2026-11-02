import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { SignInButton } from '#/components/SignInDialog'
import { listAccountDrafts } from '#/lib/drafts/drafts'
import { listLocalDrafts } from '#/lib/drafts/local'
import { draftTitle } from '#/lib/drafts/types'

interface SidebarDraft {
  sourceUrl: string
  title: string
  updatedAt: string
}

// Kept between editor visits so switching forms doesn't flash an empty list.
let cachedDrafts: Array<SidebarDraft> | undefined

// The account's drafts plus any in this browser that haven't synced yet;
// only this browser's when signed out.
async function loadDrafts(signedIn: boolean): Promise<Array<SidebarDraft>> {
  const local = listLocalDrafts().map((draft) => ({
    sourceUrl: draft.sourceUrl,
    title: draftTitle(draft.sourceUrl),
    updatedAt: draft.updatedAt,
  }))
  const account = signedIn ? ((await listAccountDrafts()) ?? []) : []

  const byUrl = new Map<string, SidebarDraft>()
  for (const draft of [...account, ...local]) {
    const existing = byUrl.get(draft.sourceUrl)
    if (!existing || existing.updatedAt < draft.updatedAt) {
      byUrl.set(draft.sourceUrl, draft)
    }
  }
  return [...byUrl.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

interface DraftSidebarProps {
  currentUrl: string
  signedIn: boolean
  // Changes when the current draft saves, so the list picks it up.
  refreshKey: string
  onNavigate?: () => void
}

export function DraftSidebar({
  currentUrl,
  signedIn,
  refreshKey,
  onNavigate,
}: DraftSidebarProps) {
  const [drafts, setDrafts] = useState(cachedDrafts)
  const [error, setError] = useState(false)

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

  return (
    <nav aria-label="Your drafts" className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-ink/20 px-4 py-3">
        <h2 className="text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
          Your drafts
        </h2>
        {signedIn && (
          <Link
            to="/drafts"
            className="text-xs font-medium text-blueprint underline-offset-2 hover:underline"
          >
            Manage
          </Link>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {drafts === undefined ? (
          <p className="px-4 py-4 text-sm text-ink/60">
            {error ? 'Drafts couldn’t be loaded.' : 'Loading…'}
          </p>
        ) : drafts.length === 0 ? (
          <p className="px-4 py-4 text-sm leading-6 text-ink/60">
            Forms you fill out are saved here automatically.
          </p>
        ) : (
          <ul className="py-1">
            {drafts.map((draft) => {
              const isCurrent = draft.sourceUrl === currentUrl
              return (
                <li key={draft.sourceUrl}>
                  <Link
                    to="/editor"
                    search={{ url: draft.sourceUrl }}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={onNavigate}
                    className={`block border-l-2 px-4 py-2.5 transition ${
                      isCurrent
                        ? 'border-blueprint bg-blueprint/10'
                        : 'border-transparent hover:bg-ink/5'
                    }`}
                  >
                    <span
                      className={`block truncate text-sm ${
                        isCurrent ? 'font-medium text-blueprint' : 'text-ink'
                      }`}
                    >
                      {draft.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink/60">
                      {hostname(draft.sourceUrl)} · {timeAgo(draft.updatedAt)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!signedIn && (
        <div className="border-t border-ink/20 px-4 py-4 text-sm leading-6 text-ink/70">
          These drafts are saved on this device only.
          <SignInButton className="mt-2 block font-medium text-blueprint underline-offset-2 hover:underline">
            Sign in to keep them
          </SignInButton>
        </div>
      )}
    </nav>
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
