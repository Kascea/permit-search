import type { ComponentProps, ReactNode } from 'react'

import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { useAuth } from '#/lib/auth/use-auth'

type AppPageProps = ComponentProps<typeof SiteHeader> & {
  // Full page width, such as results with their sidebar, instead of one
  // reading column.
  wide?: boolean
  children: ReactNode
}

// Centered, for signed-out visitors and below lg.
const CENTERED_COLUMN = 'mx-auto max-w-3xl'

// Beside AppSidebar from lg up: the column is centered on the page grid (see
// sheet-column in styles.css) and starts at least one cell in from the
// sidebar and two below SiteHeader's top bar.
const GRID_MAIN = 'lg:mx-0 lg:max-w-none lg:px-8'
const GRID_COLUMN = 'lg:sheet-column'
const GRID_WIDE_COLUMN = 'lg:sheet-column-wide'

// Every page's frame but the editor's: header, content column and footer.
// Signed in, from lg up, AppSidebar replaces the header and footer.
export function AppPage({ wide = false, children, ...header }: AppPageProps) {
  const { user } = useAuth()

  let columnClass = wide ? '' : CENTERED_COLUMN

  if (user) columnClass += ` ${wide ? GRID_WIDE_COLUMN : GRID_COLUMN}`

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader {...header} />

      <main
        className={`mx-auto w-full max-w-280 flex-1 px-4 pt-8 sm:px-6 ${
          user ? GRID_MAIN : ''
        }`}
      >
        <div className={`py-8 ${columnClass}`}>{children}</div>
      </main>

      <SiteFooter />
    </div>
  )
}
