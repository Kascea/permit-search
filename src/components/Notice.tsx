import type { ReactNode } from 'react'

// Success and error share one look everywhere: these colors and icons, in
// inline notices here and in toasts (see Toaster). See "Feedback" in DESIGN.md.
export type Tone = 'success' | 'error'

export const toneClass: Record<Tone, string> = {
  success: 'border-success bg-success-wash text-success',
  error: 'border-redline bg-redline-wash text-redline',
}

// A check in a circle, or an exclamation mark in one.
export function StatusIcon({ tone }: { tone: Tone }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path
        d={
          tone === 'success' ? 'm8.5 12.5 2.5 2.5 4.5-5' : 'M12 7.5v5m0 3.5v.01'
        }
      />
    </svg>
  )
}

// An inline message beside the form or action it's about. Errors are
// announced right away; successes politely.
export function Notice({
  tone,
  className = '',
  children,
}: {
  tone: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <p
      className={`flex items-start gap-2.5 border px-4 py-3 text-sm font-medium [&>svg]:mt-0.5 ${toneClass[tone]} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <StatusIcon tone={tone} />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
