import type { ReactNode } from 'react'

import { AppPage } from '#/components/AppPage'
import { SiteTopBar } from '#/components/SiteTopBar'
import { CONTACT_EMAIL } from '#/lib/site'

// Both legal pages show this date; change it whenever either page changes.
export const LEGAL_UPDATED = 'November 13, 2026'

export const legalLinkClass =
  'font-medium text-blueprint underline-offset-2 hover:underline'

// The frame of the Terms and Privacy pages: the About page's top bar, a title,
// and sections of plain prose.
export function LegalPage({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <AppPage topBar={<SiteTopBar />}>
      <p className="mb-4 text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        Last updated {LEGAL_UPDATED}
      </p>
      <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-ink">
        {title}
      </h1>
      <div className="mt-8">{children}</div>
    </AppPage>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mt-8 border-t border-ink pt-5">
      <h2 className="text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-6 text-ink/70 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

export function ContactLink() {
  return (
    <a className={legalLinkClass} href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  )
}
