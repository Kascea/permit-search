import { getRouteApi, useRouterState } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { useSyncExternalStore } from 'react'

// Whether the desktop sidebars (AppSidebar and the editor's file panel) are
// shrunk to their icons. One choice for both, so moving between the app and
// the editor doesn't change it. It's a cookie rather than localStorage so the
// server renders the right width and a reload doesn't flash the wide sidebar.
const COOKIE_NAME = 'permit-search-sidebar-collapsed'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const rootRoute = getRouteApi('__root__')

// Read by the root route's loader for the server render and hydration.
export const getIsSidebarCollapsed = createServerFn({ method: 'GET' }).handler(
  (): boolean => getCookie(COOKIE_NAME) === 'true',
)

// Kept here as well so the toggle still works for this visit if the browser
// refuses the cookie.
let isCollapsedInBrowser: boolean | undefined
const listeners = new Set<() => void>()

function readIsCollapsed() {
  isCollapsedInBrowser ??= document.cookie
    .split('; ')
    .includes(`${COOKIE_NAME}=true`)

  return isCollapsedInBrowser
}

function setIsCollapsed(isCollapsed: boolean) {
  isCollapsedInBrowser = isCollapsed
  document.cookie = `${COOKIE_NAME}=${isCollapsed}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`

  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

// Whether AppSidebar is beside this page, from lg up. Everyone gets it, so
// signing in doesn't move anything. The exceptions: the editor has its own file
// panel, and the signed-out home page stands alone, as the site's front door.
export function useHasAppSidebar() {
  const { user } = rootRoute.useLoaderData()

  // The page on screen, not the one being loaded, so the layout changes along
  // with the page rather than just before it.
  const pathname = useRouterState({
    select: (state) =>
      (state.resolvedLocation ?? state.location).pathname,
  })

  if (pathname.startsWith('/editor')) return false

  return Boolean(user) || pathname !== '/'
}

export function useSidebarCollapsed() {
  const { isSidebarCollapsed } = rootRoute.useLoaderData()

  const isCollapsed = useSyncExternalStore(
    subscribe,
    readIsCollapsed,
    () => isSidebarCollapsed,
  )

  return { isCollapsed, setIsCollapsed }
}
