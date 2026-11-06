import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { AddToProjectButton } from '#/components/AddToProjectDialog'
import { AppPage } from '#/components/AppPage'
import { EditedDate } from '#/components/EditedDate'
import { StaleBadge, UpdatedAge } from '#/components/SavedPermitStatus'
import { SignInGate } from '#/components/SignInGate'
import { formatCity } from '#/lib/location/format'
import { listAccountPermits, removeAccountPermit } from '#/lib/permits/permits'
import { savedPermitProjectItem } from '#/lib/permits/types'
import type { SavedPermit } from '#/lib/permits/types'
import { setSavedPermits } from '#/lib/permits/use-saved-permits'
import { confirm } from '#/components/ConfirmDialog'

const SORTS = [
  { id: 'city', label: 'City' },
  { id: 'title', label: 'Title' },
  { id: 'saved', label: 'Recently saved' },
  { id: 'updated', label: 'Least recently updated' },
] as const

type LibrarySort = (typeof SORTS)[number]['id']

// Every filter is kept in the URL, as in
// /permits?city=Minneapolis&region=Minnesota&sort=title.
const librarySearchSchema = z.object({
  city: z.string().optional().catch(undefined),
  region: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  sort: z
    .enum(['city', 'title', 'saved', 'updated'])
    .optional()
    .catch(undefined),
})

type LibrarySearch = z.output<typeof librarySearchSchema>

export const Route = createFileRoute('/permits/')({
  head: () => ({
    meta: [{ title: 'My permits | Permit Search' }],
  }),
  validateSearch: librarySearchSchema,
  // Null when signed out, so the page can ask the visitor to sign in.
  loader: () => listAccountPermits(),
  component: Permits,
})

function Permits() {
  const loaded = Route.useLoaderData()
  // Removals return the updated library, so it's kept here rather
  // than reloading the page. A fresh load wins.
  const [permits, setPermits] = useState(loaded)
  const [lastLoaded, setLastLoaded] = useState(loaded)

  if (loaded !== lastLoaded) {
    setLastLoaded(loaded)
    setPermits(loaded)
  }

  function update(list: Array<SavedPermit>) {
    setPermits(list)
    // So search results' Saved marks match.
    setSavedPermits(list)
  }

  return (
    <AppPage>
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        My permits
      </p>
      <h1 className="mt-1 text-[1.75rem] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-4xl">
        Your saved permits
      </h1>

      {!permits ? (
        <SignInGate>Sign in to save blank permit forms and online permits by city and reuse them in any project.</SignInGate>
      ) : permits.length === 0 ? (
        <p className="mt-6 max-w-[60ch] border-t border-ink pt-5 text-base leading-6 text-ink/70">
          No saved permits yet. Search for a permit, then choose{' '}
          <span className="font-medium text-ink">Save permit</span> on a PDF
          result to keep a blank copy here, or on an online permit to keep its
          application link. Each PDF shows when it was last updated, so you can
          tell when it’s worth getting a fresh copy from the city.
        </p>
      ) : (
        <Library permits={permits} onChange={update} />
      )}
    </AppPage>
  )
}

function Library({
  permits,
  onChange,
}: {
  permits: Array<SavedPermit>
  onChange: (permits: Array<SavedPermit>) => void
}) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const sort = search.sort ?? 'city'

  function setSearch(changes: Partial<LibrarySearch>) {
    void navigate({
      search: (previous) => ({ ...previous, ...changes }),
      replace: true,
    })
  }

  const cities = uniqueCities(permits)
  const types = [...new Set(permits.flatMap((permit) => permit.permitTypes))]
  const visible = sortPermits(filterPermits(permits, search), sort)

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="search"
          aria-label="Filter by title"
          className="field-input py-2.5"
          placeholder="Filter by title"
          value={search.q ?? ''}
          onChange={(event) =>
            setSearch({ q: event.target.value || undefined })
          }
        />
        <select
          aria-label="City"
          className="field-input py-2.5"
          value={search.city ? `${search.city}|${search.region ?? ''}` : ''}
          onChange={(event) => {
            const [city, region] = event.target.value.split('|')
            setSearch({ city: city || undefined, region: region || undefined })
          }}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option
              key={`${city.name}|${city.region}`}
              value={`${city.name}|${city.region}`}
            >
              {formatCity(city)} ({city.count})
            </option>
          ))}
        </select>
        <select
          aria-label="Sort by"
          className="field-input py-2.5"
          value={sort}
          onChange={(event) =>
            setSearch({
              sort:
                event.target.value === 'city'
                  ? undefined
                  : librarySearchSchema.shape.sort.parse(event.target.value),
            })
          }
        >
          {SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              Sort: {option.label}
            </option>
          ))}
        </select>
      </div>

      {types.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Permit types">
          {types.map((type) => {
            const isOn = search.type === type

            return (
              <button
                key={type}
                type="button"
                aria-pressed={isOn}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  isOn
                    ? 'border-ink bg-ink text-paper'
                    : 'border-ink/40 text-ink hover:bg-ink hover:text-paper'
                }`}
                onClick={() => setSearch({ type: isOn ? undefined : type })}
              >
                {type}
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-5 text-sm text-ink/60">
        {visible.length} of {permits.length}{' '}
        {permits.length === 1 ? 'permit' : 'permits'}
      </p>

      {visible.length === 0 ? (
        <p className="mt-3 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          No saved permits match these filters.
        </p>
      ) : sort === 'city' ? (
        groupByCity(visible).map((group) => (
          <section key={group.key} className="mt-6">
            <h2 className="text-sm font-medium text-ink">
              {formatCity(group.city)}
              <span className="font-normal text-ink/60">
                {' · '}
                {group.permits.length}{' '}
                {group.permits.length === 1 ? 'permit' : 'permits'}
              </span>
            </h2>
            <PermitList
              permits={group.permits}
              onChange={onChange}
            />
          </section>
        ))
      ) : (
        <PermitList
          permits={visible}
          onChange={onChange}
          showCity
        />
      )}
    </>
  )
}

function PermitList({
  permits,
  showCity = false,
  onChange,
}: {
  permits: Array<SavedPermit>
  showCity?: boolean
  onChange: (permits: Array<SavedPermit>) => void
}) {
  return (
    <ul className="mt-2 divide-y divide-ink/20 border-t border-b border-ink">
      {permits.map((permit) => (
        <PermitRow
          key={permit.publicId}
          permit={permit}
          showCity={showCity}
          onChange={onChange}
        />
      ))}
    </ul>
  )
}

const rowActionClass =
  'text-sm font-medium text-blueprint underline-offset-2 hover:underline'

function PermitRow({
  permit,
  showCity,
  onChange,
}: {
  permit: SavedPermit
  showCity: boolean
  onChange: (permits: Array<SavedPermit>) => void
}) {
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
      onChange(
        await removeAccountPermit({ data: { publicId: permit.publicId } }),
      )
      toast.success('Permit removed.')
    } catch {
      toast.error('The permit couldn’t be removed. Try again.')
      setIsRemoving(false)
    }
  }

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/permits/$permitId"
          params={{ permitId: permit.publicId }}
          className="min-w-0 text-lg leading-6 font-medium text-ink underline-offset-2 hover:text-blueprint hover:underline"
        >
          {permit.title}
        </Link>
        <StaleBadge permit={permit} />
      </div>

      <p className="mt-1 text-sm text-ink/60">
        {showCity && `${formatCity(permit.city)} · `}
        {permit.permitTypes.length > 0 &&
          `${permit.permitTypes.join(', ')} · `}
        {permit.kind === 'pdf'
          ? `${permit.pageCount} ${permit.pageCount === 1 ? 'page' : 'pages'}`
          : `Online on ${permit.online.providerName}`}
        {permit.projectCount > 0 &&
          ` · In ${permit.projectCount} ${
            permit.projectCount === 1 ? 'project' : 'projects'
          }`}
      </p>
      <p className="mt-0.5 text-sm text-ink/60">
        Saved <EditedDate iso={permit.savedAt} />
        {/* The catalog keeps an online permit current. */}
        {permit.kind === 'pdf' && (
          <>
            {' '}
            · Updated <UpdatedAge iso={permit.versionSavedAt} />
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {permit.kind === 'pdf' ? (
          <Link
            to="/editor"
            search={{ url: permit.sourceUrl }}
            className={rowActionClass}
          >
            Fill once
          </Link>
        ) : (
          <a
            href={permit.online.applyUrl ?? permit.online.pageUrl}
            target="_blank"
            rel="noreferrer"
            className={rowActionClass}
          >
            Apply on {permit.online.providerName}{' '}
            <span aria-hidden="true">↗</span>
          </a>
        )}
        <AddToProjectButton
          city={permit.city}
          item={savedPermitProjectItem(permit)}
        />
        <button
          type="button"
          disabled={isRemoving}
          className="text-sm text-ink/60 underline-offset-2 hover:text-redline hover:underline disabled:opacity-50"
          onClick={() => void remove()}
        >
          Remove
        </button>
      </div>
    </li>
  )
}

function filterPermits(permits: Array<SavedPermit>, search: LibrarySearch) {
  const query = search.q?.trim().toLowerCase()

  return permits.filter(
    (permit) =>
      (!search.city ||
        (permit.city.name === search.city &&
          permit.city.region === search.region)) &&
      (!search.type || permit.permitTypes.includes(search.type)) &&
      (!query || permit.title.toLowerCase().includes(query)),
  )
}

// The server sends them by city, then title.
function sortPermits(permits: Array<SavedPermit>, sort: LibrarySort) {
  switch (sort) {
    case 'city':
      return permits
    case 'title':
      return [...permits].sort((a, b) => a.title.localeCompare(b.title))
    case 'saved':
      return [...permits].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    case 'updated':
      return [...permits].sort((a, b) =>
        a.versionSavedAt.localeCompare(b.versionSavedAt),
      )
  }
}

function uniqueCities(permits: Array<SavedPermit>) {
  return groupByCity(permits).map((group) => ({
    ...group.city,
    count: group.permits.length,
  }))
}

// Consecutive permits in the same city, as the server orders them.
function groupByCity(permits: Array<SavedPermit>) {
  const groups: Array<{
    key: string
    city: SavedPermit['city']
    permits: Array<SavedPermit>
  }> = []

  for (const permit of permits) {
    const key = `${permit.city.name}|${permit.city.region}`
    const last = groups.at(-1)

    if (last?.key === key) last.permits.push(permit)
    else groups.push({ key, city: permit.city, permits: [permit] })
  }

  return groups
}
