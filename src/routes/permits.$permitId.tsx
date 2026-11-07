import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { AddToProjectButton } from '#/components/AddToProjectDialog'
import { AppPage } from '#/components/AppPage'
import { EditedDate } from '#/components/EditedDate'
import { Notice } from '#/components/Notice'
import { StaleBadge, UpdatedAge } from '#/components/SavedPermitStatus'
import { SignInGate } from '#/components/SignInGate'
import { primaryButtonClass } from '#/components/buttons'
import { errorMessage } from '#/lib/errors'
import { formatCity } from '#/lib/location/format'
import { searchRouteParams } from '#/lib/navigation/origin'
import {
  getAccountPermit,
  removeAccountPermit,
  updateAccountPermit,
} from '#/lib/permits/permits'
import {
  MAX_PERMIT_NOTES_LENGTH,
  MAX_PERMIT_TITLE_LENGTH,
  STALE_AFTER_DAYS,
  isStale,
  savedPermitProjectItem,
} from '#/lib/permits/types'
import type {
  SavedOnlinePermit,
  SavedPdfPermit,
  SavedPermit,
} from '#/lib/permits/types'
import {
  putSavedPermit,
  setSavedPermits,
} from '#/lib/permits/use-saved-permits'
import { confirm } from '#/components/ConfirmDialog'

export const Route = createFileRoute('/permits/$permitId')({
  loader: ({ params }) =>
    getAccountPermit({ data: { publicId: params.permitId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.permit?.title ?? 'Saved permit'} | Permit Search`,
      },
    ],
  }),
  component: SavedPermitPage,
})

function SavedPermitPage() {
  const loaded = Route.useLoaderData()

  return (
    <AppPage>
      <Link
        to="/permits"
        className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase underline-offset-2 hover:underline"
      >
        My permits
      </Link>

      {!loaded ? (
        <SignInGate>Sign in to see your saved permits.</SignInGate>
      ) : !loaded.permit ? (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          This permit isn’t in your library. It may have been removed.
        </p>
      ) : (
        <PermitDetails
          key={loaded.permit.publicId}
          permit={loaded.permit}
          projects={loaded.projects}
        />
      )}
    </AppPage>
  )
}

function PermitDetails({
  permit,
  projects,
}: {
  permit: SavedPermit
  projects: Array<{ publicId: string; name: string }>
}) {
  const navigate = useNavigate()
  const [isRemoving, setIsRemoving] = useState(false)

  async function remove() {
    if (
      !(await confirm({
        title: `Remove “${permit.title}” from My permits?`,
        message: 'Projects that use it keep it.',
        confirmLabel: 'Remove permit',
        isDestructive: true,
      }))
    ) {
      return
    }

    setIsRemoving(true)

    try {
      setSavedPermits(
        await removeAccountPermit({ data: { publicId: permit.publicId } }),
      )
      toast.success('Permit removed.')
      await navigate({ to: '/permits' })
    } catch {
      toast.error('The permit couldn’t be removed. Try again.')
      setIsRemoving(false)
    }
  }

  return (
    <>
      <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        {permit.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink/70">{formatCity(permit.city)}</span>
        <StaleBadge permit={permit} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {permit.kind === 'pdf' ? (
          <Link
            to="/editor"
            search={{ url: permit.sourceUrl }}
            className={primaryButtonClass}
          >
            Fill once
          </Link>
        ) : (
          <a
            href={permit.online.applyUrl ?? permit.online.pageUrl}
            target="_blank"
            rel="noreferrer"
            className={primaryButtonClass}
          >
            Apply on {permit.online.providerName}{' '}
            <span aria-hidden="true">↗</span>
          </a>
        )}
        <AddToProjectButton
          city={permit.city}
          item={savedPermitProjectItem(permit)}
        />
      </div>

      {permit.kind === 'pdf' ? (
        <PdfVersion permit={permit} />
      ) : (
        <OnlineRequirements permit={permit} />
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-ink">
          {permit.kind === 'pdf' ? 'The form' : 'The online permit'}
        </h2>
        <dl className="mt-2 divide-y divide-ink/20 border-t border-b border-ink text-sm">
          <Fact label="Permit types">
            {permit.permitTypes.length > 0 ? (
              permit.permitTypes.join(', ')
            ) : (
              <span className="text-ink/60">None recorded</span>
            )}
          </Fact>
          {permit.kind === 'pdf' ? (
            <>
              <Fact label="Size">
                {permit.pageCount} {permit.pageCount === 1 ? 'page' : 'pages'},{' '}
                {permit.fieldCount}{' '}
                {permit.fieldCount === 1 ? 'fillable field' : 'fillable fields'}
              </Fact>
              <Fact label="City’s link">
                <a
                  href={permit.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-blueprint underline-offset-2 hover:underline"
                >
                  {permit.sourceUrl}
                </a>
              </Fact>
              <Fact label="Saved copy">
                <a
                  href={`/api/pdf?hash=${permit.sourceHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blueprint underline-offset-2 hover:underline"
                >
                  Open the saved PDF
                </a>
              </Fact>
            </>
          ) : (
            <>
              <Fact label="Permit portal">{permit.online.providerName}</Fact>
              {permit.online.category && (
                <Fact label="Category">{permit.online.category}</Fact>
              )}
              <Fact label="City’s page">
                <a
                  href={permit.online.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-blueprint underline-offset-2 hover:underline"
                >
                  {permit.online.pageUrl}
                </a>
              </Fact>
            </>
          )}
          {permit.search && (
            <Fact label="Found in">
              <Link
                to="/results/$citySlug/$querySlug"
                params={searchRouteParams(permit.search.slug)}
                className="text-blueprint underline-offset-2 hover:underline"
              >
                {permit.search.label}
              </Link>
            </Fact>
          )}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-ink">Projects using it</h2>
        {projects.length === 0 ? (
          <p className="mt-2 border-t border-ink pt-3 text-sm text-ink/60">
            None yet. Add it to a project to fill it from the project’s
            details.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-ink/20 border-t border-b border-ink text-sm">
            {projects.map((project) => (
              <li key={project.publicId} className="py-2.5">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.publicId }}
                  className="font-medium text-ink underline-offset-2 hover:text-blueprint hover:underline"
                >
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PermitEditForm permit={permit} />

      <button
        type="button"
        disabled={isRemoving}
        className="mt-8 text-sm text-ink/60 underline-offset-2 hover:text-redline hover:underline disabled:opacity-50"
        onClick={() => void remove()}
      >
        Remove from My permits
      </button>
    </>
  )
}

// When the stored copy was downloaded from the city, and how old it is.
function PdfVersion({ permit }: { permit: SavedPdfPermit }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">Version</h2>
      <dl className="mt-2 divide-y divide-ink/20 border-t border-b border-ink text-sm">
        <Fact label="Saved to your library">
          <EditedDate iso={permit.savedAt} />
        </Fact>
        <Fact label="Last updated from the city">
          <EditedDate iso={permit.versionSavedAt} />
          <span className="text-ink/60">
            {' '}
            (<UpdatedAge iso={permit.versionSavedAt} />)
          </span>
          {isStale(permit) && (
            <p className="mt-1 text-redline" suppressHydrationWarning>
              Over {STALE_AFTER_DAYS} days old. The city may have posted a newer
              version; compare with the city’s link below before you submit.
            </p>
          )}
        </Fact>
        <Fact label="Date inside the PDF">
          {permit.pdfModifiedAt ? (
            <EditedDate iso={permit.pdfModifiedAt} />
          ) : (
            <span className="text-ink/60">None given</span>
          )}
        </Fact>
      </dl>
    </section>
  )
}

// What the city asks for with the application. The catalog keeps it
// current, so there's no version to show.
function OnlineRequirements({ permit }: { permit: SavedOnlinePermit }) {
  const { online } = permit
  const documents = online.requirements?.documents ?? []

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">Requirements</h2>
      <dl className="mt-2 divide-y divide-ink/20 border-t border-b border-ink text-sm">
        <Fact label="Saved to your library">
          <EditedDate iso={permit.savedAt} />
        </Fact>
        {online.plansRequired !== null && (
          <Fact label="Plans required">
            {online.plansRequired ? 'Yes' : 'No'}
          </Fact>
        )}
        <Fact label="The city asks for">
          {documents.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {documents.map((document) => (
                <li key={document}>{document}</li>
              ))}
            </ul>
          ) : (
            <span className="text-ink/60">Not listed</span>
          )}
        </Fact>
      </dl>
    </section>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-ink/60">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  )
}

// Rename the permit and keep notes on it, such as "Submit with site plan".
function PermitEditForm({ permit }: { permit: SavedPermit }) {
  const router = useRouter()
  const titleId = useId()
  const notesId = useId()
  const [title, setTitle] = useState(permit.title)
  const [notes, setNotes] = useState(permit.notes)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const isChanged = title !== permit.title || notes !== permit.notes

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      const saved = await updateAccountPermit({
        data: { publicId: permit.publicId, title, notes },
      })

      if (saved) putSavedPermit(saved)
      await router.invalidate()
      toast.success('Permit saved.')
    } catch (saveError) {
      setError(errorMessage(saveError, 'The permit couldn’t be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="mt-8" noValidate onSubmit={save}>
      <h2 className="text-sm font-medium text-ink">Title and notes</h2>
      <div className="mt-2 grid gap-4 border-t border-ink pt-4">
        <div>
          <label className="text-sm text-ink/70" htmlFor={titleId}>
            Title
          </label>
          <input
            id={titleId}
            className="field-input mt-1 py-2.5"
            maxLength={MAX_PERMIT_TITLE_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-ink/70" htmlFor={notesId}>
            Notes
          </label>
          <textarea
            id={notesId}
            className="field-input mt-1 min-h-24 py-2.5"
            maxLength={MAX_PERMIT_NOTES_LENGTH}
            placeholder="e.g. Submit with a site plan"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}
      <button
        type="submit"
        disabled={!isChanged || isSaving}
        // Fill once is the page's one primary button.
        className="mt-4 rounded-full border border-ink/40 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
