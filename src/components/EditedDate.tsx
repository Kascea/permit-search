import { useHydrated } from '@tanstack/react-router'

// The server renders in UTC and the browser in the visitor's time zone, so
// the date is shown in UTC until hydration, then in the visitor's own zone.
// Formatting in the visitor's zone straight away broke hydration near midnight.
export function EditedDate({ iso }: { iso: string }) {
  const isHydrated = useHydrated()
  return (
    <time dateTime={iso}>
      {new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: isHydrated ? undefined : 'UTC',
      })}
    </time>
  )
}
