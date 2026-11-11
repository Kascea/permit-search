import { useMatch } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { useSyncExternalStore } from 'react'

// Light or dark, or 'system' to follow the device. It's a cookie rather than
// localStorage so the server renders the chosen theme and a reload doesn't
// flash the other one. With no choice, styles.css follows the system's
// setting on its own, so it needs no script.
export type ThemePreference = 'system' | 'light' | 'dark'

const COOKIE_NAME = 'permit-search-theme'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function parse(value: string | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

// Read by the root route's loader for the server render and hydration.
export const getThemePreference = createServerFn({ method: 'GET' }).handler(
  (): ThemePreference => parse(getCookie(COOKIE_NAME)),
)

// Kept here as well so the choice still works for this visit if the browser
// refuses the cookie.
let themeInBrowser: ThemePreference | undefined
const listeners = new Set<() => void>()

function readTheme() {
  themeInBrowser ??= parse(
    document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1),
  )

  return themeInBrowser
}

function setTheme(theme: ThemePreference) {
  themeInBrowser = theme
  document.cookie =
    theme === 'system'
      ? `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
      : `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`

  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

export function useTheme() {
  // Without throwing, since the document shell uses this too and still renders
  // if the root loader failed.
  const themeFromServer = parse(
    useMatch({
      from: '__root__',
      shouldThrow: false,
      select: (match) => match.loaderData?.theme,
    }),
  )

  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    () => themeFromServer,
  )

  return { theme, setTheme }
}
