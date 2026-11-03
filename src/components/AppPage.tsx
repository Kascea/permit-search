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
const CENTERED_COLUMN = 'mx-auto max-w-[780px]'

// Beside AppSidebar from lg up: the column is centered in the space beside
// the sidebar, but its offset is rounded down to whole 32px grid cells, so
// its edges, headings and rules stay on the page's lines at any window width.
// It starts at least one cell in from the sidebar and two below SiteHeader's
// top bar. Main's left and top padding are 31px because the content column's
// border and the top bar's rule take the 32nd pixel.
const GRID_MAIN = 'lg:mx-0 lg:max-w-none lg:pt-[31px] lg:pr-8 lg:pl-[31px]'

const GRID_COLUMN =
  'lg:mr-0 lg:ml-[max(0px,round(down,calc((100%_-_768px)/2),32px))] lg:max-w-[768px]'

const GRID_WIDE_COLUMN =
  'lg:ml-[max(0px,round(down,calc((100%_-_1120px)/2),32px))] lg:max-w-[1120px]'

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
        className={`mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6 ${
          user ? GRID_MAIN : ''
        }`}
      >
        <div className={`py-8 ${columnClass}`}>{children}</div>
      </main>

      <SiteFooter />
    </div>
  )
}
