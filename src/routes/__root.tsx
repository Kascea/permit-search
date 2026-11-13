import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { AppSidebar } from '#/components/AppSidebar'
import { ConfirmHost } from '#/components/ConfirmDialog'
import { getAuthState } from '#/lib/auth/session'
import { getIsSidebarCollapsed, useHasAppSidebar } from '#/lib/navigation/sidebar'
import { LocalDraftSync } from '#/components/LocalDraftSync'
import { OAuthErrorToast } from '#/components/OAuthErrorToast'
import { getThemePreference, useTheme } from '#/lib/theme'
import { Toaster } from '#/components/Toaster'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Permit Search | Find local permit requirements',
      },
      {
        name: 'description',
        content:
          'Find city permit requirements for home improvement and construction projects.',
      },
      // The paper color in each theme, for the browser's own toolbar.
      {
        name: 'theme-color',
        content: '#fdfff1',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#1d1c1a',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    links: [
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '32x32',
      },
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  // Reloaded by router.invalidate() after signing in or out.
  loader: async () => {
    const [authState, isSidebarCollapsed, theme] = await Promise.all([
      getAuthState(),
      getIsSidebarCollapsed(),
      getThemePreference(),
    ])

    return { ...authState, isSidebarCollapsed, theme }
  },
  staleTime: Infinity,
  shellComponent: RootDocument,
  component: AppLayout,
})

// Pages sit beside the sidebar, except where useHasAppSidebar says otherwise.
function AppLayout() {
  if (!useHasAppSidebar()) return <Outlet />

  return (
    <div className="lg:flex">
      <AppSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  const { theme } = useTheme()

  return (
    // Without a choice, styles.css follows the system's setting.
    <html lang="en" data-theme={theme === 'system' ? undefined : theme}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <LocalDraftSync />
        <Toaster />
        <OAuthErrorToast />
        <ConfirmHost />
        <Scripts />
      </body>
    </html>
  )
}
