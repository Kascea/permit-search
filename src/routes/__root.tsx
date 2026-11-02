import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { getAuthState } from '#/lib/auth/session'
import { LocalDraftSync } from '#/components/LocalDraftSync'
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
      {
        name: 'theme-color',
        content: '#115e59',
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
  // Sign-in sends the browser away and back, so this only needs reloading
  // after sign-out (router.invalidate()).
  loader: () => getAuthState(),
  staleTime: Infinity,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <LocalDraftSync />
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
