import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SiteFooter } from '#/components/SiteFooter'
import { errorMessage } from '#/lib/errors'

// Shown when a page fails to load. Server errors arrive already made generic
// (see src/start.ts); errorMessage covers failures in the browser too.
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <ErrorPage
      title="This page couldn’t load"
      message={errorMessage(error, 'Something went wrong. Try again.')}
    >
      <button
        type="button"
        className="rounded-full bg-blueprint px-4 py-2 font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        {/* Sized on the span: the global button font rule overrides it on
            the button itself. */}
        <span className="text-sm">Try again</span>
      </button>
    </ErrorPage>
  )
}

export function RouteNotFound() {
  return (
    <ErrorPage
      title="Page not found"
      message="This page has moved or doesn’t exist."
    />
  )
}

// No account menu: it reads the root route's data, which may be what failed.
function ErrorPage({
  title,
  message,
  children,
}: {
  title: string
  message: string
  children?: ReactNode
}) {
  // AppSidebar is beside the page when the root route loaded a user; from lg
  // up it has the logo, and this is the bare top bar beside it, as in
  // SiteHeader. Read without throwing, for the same reason.
  const besideSidebar = useRouterState({
    select: (state) => {
      const root = state.matches.at(0)?.loaderData

      return Boolean(root && 'user' in root && root.user)
    },
  })

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink bg-sheet px-4 sm:px-6">
        <div
          className={`mx-auto flex h-14 max-w-[1120px] items-center ${
            besideSidebar ? 'lg:h-16' : ''
          }`}
        >
          <Link
            to="/"
            aria-label="Permit Search home"
            className={`flex items-center gap-2.5 text-ink ${
              besideSidebar ? 'lg:hidden' : ''
            }`}
          >
            <PermitSearchLogo className="size-7" />
            <span className="text-sm font-medium tracking-tight">
              Permit Search
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        <section className="mx-auto max-w-[780px] py-8" role="alert">
          <h1 className="text-[28px] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-base leading-6 text-ink/70">{message}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {children}
            <Link
              to="/"
              className="text-sm font-medium text-blueprint underline-offset-2 hover:underline"
            >
              Go to the home page
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
