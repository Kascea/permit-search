import { AddToProjectButton } from '#/components/AddToProjectDialog'
import { quietActionClass, rowPrimaryButtonClass } from '#/components/buttons'
import { SavePermitButton } from '#/components/SavePermitButton'
import type { OnlineApplicationMatch } from '#/lib/portals/types'
import type { OnlineApplicationsPreview } from '#/lib/search/types'

const badgeClass =
  'rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] uppercase'

// A search in a city on a supported permit portal opens with the city's own
// online permit types that the project needs, before the web results. See
// docs/search-flow-plan.md. It also shows while the web search is still
// running, before the search is saved; it has no searchSlug then.
export function OnlineApplications({
  response,
  city,
  searchSlug,
}: {
  response: Partial<OnlineApplicationsPreview>
  city: { name: string; region: string }
  searchSlug?: string
}) {
  const { portal, onlineApplications = [] } = response

  if (!portal) return null

  return (
    <section className="mt-6 border-t border-ink pt-4">
      <p className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        Apply online · {city.name} {portal.providerName}
      </p>
      {onlineApplications.length === 0 ? (
        <p className="mt-2 text-base leading-6 text-ink/70">
          None of {city.name}’s online permits match this project. Use the
          forms and pages below, or{' '}
          <a
            href={portal.applyUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blueprint underline-offset-2 hover:underline"
          >
            browse {city.name}’s online permits
          </a>
          .
        </p>
      ) : (
        <ol className="mt-1 divide-y divide-ink/20">
          {onlineApplications.map((match) => (
            <OnlineApplication
              key={match.id}
              match={match}
              city={city}
              searchSlug={searchSlug}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function OnlineApplication({
  match,
  city,
  searchSlug,
}: {
  match: OnlineApplicationMatch
  city: { name: string; region: string }
  searchSlug?: string
}) {
  const documents = match.requirements?.documents ?? []

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${badgeClass} bg-blueprint/10 text-blueprint`}>
          Online application
        </span>
        {match.plansRequired && (
          <span className={`${badgeClass} bg-ink/10 text-ink/70`}>
            Plans required
          </span>
        )}
      </div>
      <h2 className="mt-1 text-lg leading-6 font-medium text-ink">
        {match.name}
      </h2>
      {match.category && (
        <p className="text-sm text-ink/60">{match.category}</p>
      )}
      {documents.length > 0 && (
        <div className="mt-2 text-base leading-6 text-ink/70">
          <p>The city asks for:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {documents.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
        {match.applyUrl && (
          <a
            href={match.applyUrl}
            target="_blank"
            rel="noreferrer"
            className={`mr-2 ${rowPrimaryButtonClass}`}
          >
            Apply on {match.providerName}
            <span aria-hidden="true">↗</span>
          </a>
        )}
        {/* Only when applying starts somewhere else. */}
        {match.applyUrl !== match.pageUrl && (
          <a
            href={match.pageUrl}
            target="_blank"
            rel="noreferrer"
            className={quietActionClass}
          >
            Requirements <span aria-hidden="true">↗</span>
          </a>
        )}
        {/* Not before the search is saved: the page moves to the saved
            results then, which would close a dialog mid-use. */}
        {searchSlug && (
          <>
            <SavePermitButton
              sourceUrl={match.pageUrl}
              title={match.name}
              city={city}
              searchSlug={searchSlug}
              portalPermitTypeId={match.id}
            />
            <AddToProjectButton
              city={city}
              item={{
                sourceUrl: match.pageUrl,
                title: match.name,
                searchSlug,
                portalPermitTypeId: match.id,
              }}
            />
          </>
        )}
      </div>
    </li>
  )
}
