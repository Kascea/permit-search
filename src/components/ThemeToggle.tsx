import { useTheme } from '#/lib/theme'
import type { ThemePreference } from '#/lib/theme'

// Outline icon paths on a 24px grid.
const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  {
    value: 'system',
    label: 'Match system',
    icon: 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25',
  },
  {
    value: 'light',
    label: 'Light',
    icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z',
  },
]

// The light or dark choice, for everyone, in the account menu and the
// sidebar. "compact" is a single button that steps through the three, for the
// collapsed sidebar.
export function ThemeToggle({
  compact = false,
  className = '',
}: {
  compact?: boolean
  className?: string
}) {
  const { theme, setTheme } = useTheme()

  if (compact) {
    const index = OPTIONS.findIndex((option) => option.value === theme)
    const current = OPTIONS[index]
    const next = OPTIONS[(index + 1) % OPTIONS.length]

    return (
      <button
        type="button"
        aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
        title={`Theme: ${current.label}`}
        className={`grid size-8 place-items-center rounded-full text-ink/60 transition hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint ${className}`}
        onClick={() => setTheme(next.value)}
      >
        <ThemeIcon path={current.icon} />
      </button>
    )
  }

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="text-sm text-ink">Theme</span>
      <div
        role="group"
        aria-label="Theme"
        className="flex rounded-full border border-ink/35 p-0.5"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={theme === option.value}
            title={option.label}
            className={`grid size-7 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blueprint ${
              theme === option.value
                ? 'bg-ink text-paper'
                : 'text-ink/60 hover:text-ink'
            }`}
            onClick={() => setTheme(option.value)}
          >
            <ThemeIcon path={option.icon} />
          </button>
        ))}
      </div>
    </div>
  )
}

function ThemeIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}
