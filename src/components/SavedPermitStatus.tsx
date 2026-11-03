import { STALE_AFTER_DAYS, isStale } from '#/lib/permits/types'
import type { SavedPermit } from '#/lib/permits/types'

const DAY_MS = 24 * 60 * 60 * 1000

// "today", "3 days ago", "2 months ago". Relative to the visitor's clock, so
// the server's render may differ by a day around midnight.
export function formatAge(iso: string, now = Date.now()) {
  const days = Math.floor((now - Date.parse(iso)) / DAY_MS)

  if (days < 1) return 'today'

  if (days === 1) return 'yesterday'

  if (days < 30) return `${days} days ago`

  const months = Math.floor(days / 30)

  if (months < 12) return months === 1 ? 'a month ago' : `${months} months ago`

  const years = Math.floor(days / 365)

  return years === 1 ? 'a year ago' : `${years} years ago`
}

export function UpdatedAge({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatAge(iso)}
    </time>
  )
}

// Marks a stored copy old enough that the city may have posted a newer form.
export function StaleBadge({ permit }: { permit: SavedPermit }) {
  if (!isStale(permit)) return null

  return (
    <span
      className="rounded-full bg-redline/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-redline uppercase"
      title={`This copy is over ${STALE_AFTER_DAYS} days old. The city may have posted a newer form.`}
      suppressHydrationWarning
    >
      Not updated in {STALE_AFTER_DAYS}+ days
    </span>
  )
}
