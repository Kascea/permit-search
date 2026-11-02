import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { SiteFooter } from '#/components/SiteFooter'
import { SiteHeader } from '#/components/SiteHeader'
import { SignInButton } from '#/components/SignInDialog'
import { deleteAccountDraft, listAccountDrafts } from '#/lib/drafts/drafts'
import type { DraftSummary } from '#/lib/drafts/types'

export const Route = createFileRoute('/drafts')({
  head: () => ({
    meta: [{ title: 'Drafts | Permit Search' }],
  }),
  loader: () => listAccountDrafts(),
  component: Drafts,
})

function Drafts() {
  const drafts = Route.useLoaderData()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-8 sm:px-6">
        <section className="mx-auto max-w-[780px] py-8">
          <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
            Drafts
          </p>
          <h1 className="mt-1 text-2xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-3xl">
            Forms you’ve started
          </h1>

          {drafts ? (
            <DraftList drafts={drafts} />
          ) : (
            <div className="mt-6 border-t border-ink pt-5">
              <p className="text-sm leading-6 text-ink/70">
                Sign in to see forms you’ve saved to your account. Forms you
                fill out while signed out are saved on this device.
              </p>
              <SignInButton className="mt-5 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep" />
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function DraftList({ drafts }: { drafts: Array<DraftSummary> }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string>()
  const [error, setError] = useState('')

  async function remove(draft: DraftSummary) {
    if (!window.confirm(`Delete your draft of “${draft.title}”?`)) return
    setError('')
    setDeletingId(draft.publicId)
    try {
      await deleteAccountDraft({ data: { publicId: draft.publicId } })
      await router.invalidate()
    } catch {
      setError('That draft could not be deleted. Try again.')
    } finally {
      setDeletingId(undefined)
    }
  }

  return (
    <>
      {error && (
        <p className="mt-6 text-sm text-redline" role="alert">
          {error}
        </p>
      )}

      {drafts.length === 0 ? (
        <p className="mt-6 border-t border-ink pt-5 text-sm leading-6 text-ink/70">
          No drafts yet. When you fill out a PDF form from your search results,
          your entries save here automatically.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/20 border-t border-b border-ink">
          {drafts.map((draft) => (
            <li
              key={draft.publicId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{draft.title}</p>
                <p className="mt-0.5 truncate text-sm text-ink/60">
                  {hostname(draft.sourceUrl)} · Edited{' '}
                  {formatEdited(draft.updatedAt)}
                </p>
              </div>
              <Link
                to="/editor"
                search={{ url: draft.sourceUrl }}
                className="rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
              >
                Open
              </Link>
              <button
                type="button"
                disabled={deletingId === draft.publicId}
                className="rounded-full border border-ink/35 px-4 py-2 text-sm font-medium transition hover:border-redline hover:text-redline disabled:opacity-50"
                onClick={() => void remove(draft)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatEdited(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
