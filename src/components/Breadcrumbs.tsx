import { Link } from '@tanstack/react-router'
import { Children } from 'react'
import type { ReactNode } from 'react'

import type { Origin } from '#/lib/navigation/origin'

export const crumbLinkClass =
  'block truncate text-ink/60 underline-offset-2 transition hover:text-ink hover:underline'

// A trail of links back to where the page was opened from, ending with the
// current page when given. Each link truncates rather than wrapping.
export function Breadcrumbs({
  children,
  current,
  className = '',
}: {
  children: ReactNode
  current?: ReactNode
  className?: string
}) {
  const links = Children.toArray(children)

  return (
    <nav aria-label="Breadcrumb" className={`min-w-0 ${className}`}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {links.map((link, index) => (
          <li
            key={index}
            className="flex max-w-[45%] min-w-0 shrink items-center gap-1.5"
          >
            {link}
            {(current !== undefined || index < links.length - 1) && (
              <span aria-hidden="true" className="text-ink/30">
                ›
              </span>
            )}
          </li>
        ))}
        {current !== undefined && (
          <li aria-current="page" className="min-w-0 flex-1 truncate">
            {current}
          </li>
        )}
      </ol>
    </nav>
  )
}

// A breadcrumb link to the page an origin names. `label` is the search's or
// project's name once known.
export function OriginCrumb({
  origin,
  label,
}: {
  origin: Origin
  label?: string
}) {
  if (origin.kind === 'search') {
    return (
      <Link
        to="/search/results/$searchId"
        params={{ searchId: origin.id }}
        className={crumbLinkClass}
      >
        {label ?? 'Search results'}
      </Link>
    )
  }

  if (origin.kind === 'project') {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId: origin.id }}
        className={crumbLinkClass}
      >
        {label ?? 'Project'}
      </Link>
    )
  }

  return (
    <Link to="/drafts" className={crumbLinkClass}>
      Drafts
    </Link>
  )
}
