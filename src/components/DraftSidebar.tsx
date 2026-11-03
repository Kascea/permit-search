import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { SignInButton } from '#/components/SignInDialog'
import { listAccountDrafts } from '#/lib/drafts/drafts'
import { listLocalDrafts } from '#/lib/drafts/local'
import { draftTitle } from '#/lib/drafts/types'
import { useAccountProjects } from '#/lib/projects/use-account-projects'

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

  const draftsByUrl = new Map(drafts?.map((draft) => [draft.sourceUrl, draft]))
  const projectUrls = new Set(
    projects?.flatMap(({ items }) => items.map(({ sourceUrl }) => sourceUrl)),
  )
  // PDFs in a project are listed there, so drafts only lists the rest.
  const otherDrafts = drafts?.filter(
    ({ sourceUrl }) => !projectUrls.has(sourceUrl),
  )
  const hasProjects = projects !== undefined && projects.length > 0

  return (
    <nav aria-label="Your projects and drafts" className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {signedIn && (
          <section>
            <SectionHeading title="Projects">
              <Link
                to="/projects"
                className="text-xs font-medium text-blueprint underline-offset-2 hover:underline"
              >
                Manage
              </Link>
            </SectionHeading>
            {projects === undefined ? (
              <p className="px-4 py-4 text-sm text-ink/60">
                {projectsError ? 'Projects couldn’t be loaded.' : 'Loading…'}
              </p>
            ) : projects.length === 0 ? (
              <p className="px-4 py-4 text-sm leading-6 text-ink/60">
                Save your property and contact details in a project to fill out
                forms faster.{' '}
                <Link
                  to="/projects/new"
                  className="font-medium text-blueprint underline-offset-2 hover:underline"
                >
                  Start a project
                </Link>
              </p>
            ) : (
              <ul className="py-1">
                {projects.map((project, index) => {
                  const hasCurrent = project.items.some(
                    ({ sourceUrl }) => sourceUrl === currentUrl,
                  )
                  return (
                    <li key={project.publicId}>
                      {/* The project with the open PDF starts expanded, or the
                          most recent one when the PDF isn't in a project. */}
                      <details
                        className="group/project"
                        open={
                          hasCurrent ||
                          (index === 0 && !projectUrls.has(currentUrl))
                        }
                      >
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
                          <svg
                            aria-hidden="true"
                            className="size-3 shrink-0 text-ink/50 transition group-open/project:rotate-90"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m9 18 6-6-6-6"
                            />
                          </svg>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {project.name}
                            </span>
                            {project.city && (
                              <span className="block truncate text-xs text-ink/60">
                                {project.city.name}, {project.city.region}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-ink/50">
                            {project.items.length}
                          </span>
                        </summary>
                        {project.items.length === 0 ? (
                          <p className="py-2 pr-4 pl-9 text-xs text-ink/60">
                            No PDFs yet.
                          </p>
                        ) : (
                          <ul className="pb-1">
                            {project.items.map((item) => {
                              const draft = draftsByUrl.get(item.sourceUrl)
                              return (
                                <li key={item.sourceUrl}>
                                  <PdfLink
                                    sourceUrl={item.sourceUrl}
                                    title={item.title}
                                    detail={
                                      draft
                                        ? `Draft · ${timeAgo(draft.updatedAt)}`
                                        : hostname(item.sourceUrl)
                                    }
                                    isCurrent={item.sourceUrl === currentUrl}
                                    indented
                                    onNavigate={onNavigate}
                                  />
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </details>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        <section>
          <SectionHeading title={hasProjects ? 'Other drafts' : 'Your drafts'}>
            {signedIn && !hasProjects && (
              <Link
                to="/drafts"
                className="text-xs font-medium text-blueprint underline-offset-2 hover:underline"
              >
                Manage
              </Link>
            )}
          </SectionHeading>
          {otherDrafts === undefined ? (
            <p className="px-4 py-4 text-sm text-ink/60">
              {error ? 'Drafts couldn’t be loaded.' : 'Loading…'}
            </p>
          ) : otherDrafts.length === 0 ? (
            <p className="px-4 py-4 text-sm leading-6 text-ink/60">
              {hasProjects
                ? 'Forms you fill out outside a project are saved here.'
                : 'Forms you fill out are saved here automatically.'}
            </p>
          ) : (
            <ul className="py-1">
              {otherDrafts.map((draft) => (
                <li key={draft.sourceUrl}>
                  <PdfLink
                    sourceUrl={draft.sourceUrl}
                    title={draft.title}
                    detail={`${hostname(draft.sourceUrl)} · ${timeAgo(draft.updatedAt)}`}
                    isCurrent={draft.sourceUrl === currentUrl}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {!signedIn && (
        <div className="border-t border-ink/20 px-4 py-4 text-sm leading-6 text-ink/70">
          These drafts are saved on this device only.
          <SignInButton className="mt-2 block font-medium text-blueprint underline-offset-2 hover:underline">
            Sign in to keep them and use projects
          </SignInButton>
        </div>
      )}
    </nav>
  )
}

function SectionHeading({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink/20 px-4 py-3">
      <h2 className="text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
        {title}
      </h2>
      {children}
    </div>
  )
}

function PdfLink({
  sourceUrl,
  title,
  detail,
  isCurrent,
  indented = false,
  onNavigate,
}: {
  sourceUrl: string
  title: string
  detail: string
  isCurrent: boolean
  // Lines items up under their project's name.
  indented?: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      to="/editor"
      search={{ url: sourceUrl }}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={onNavigate}
      className={`block border-l-2 py-2.5 pr-4 transition ${
        indented ? 'pl-9' : 'pl-4'
      } ${
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
        {title}
      </span>
      <span className="mt-0.5 block truncate text-xs text-ink/60">
        {detail}
      </span>
    </Link>
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
