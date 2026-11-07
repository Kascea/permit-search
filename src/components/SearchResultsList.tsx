import { Link } from '@tanstack/react-router'

import { AddToProjectButton } from '#/components/AddToProjectDialog'
import { OnlineApplications } from '#/components/OnlineApplications'
import { rowPrimaryButtonClass } from '#/components/buttons'
import { SavePermitButton } from '#/components/SavePermitButton'
import { useAuth } from '#/lib/auth/use-auth'
import { useAccountProjects } from '#/lib/projects/use-account-projects'
import { originParam } from '#/lib/navigation/origin'
import { isPdfUrl } from '#/lib/pdf/url'
import type { Project } from '#/lib/projects/types'
import type {
  PermitSearchResponse,
  PermitSearchResult,
} from '#/lib/search/types'

// Searches saved before links were checked fall back to the link's address.
function isPdf(result: PermitSearchResult) {
  return result.isPdf ?? isPdfUrl(result.url)
}

// The project to open a PDF in: the one holding it. With none or several,
// it opens on its own, outside a project, rather than guessing.
function onlyProjectHolding(
  sourceUrl: string,
  projects: Array<Project> | undefined,
) {
  const holding = (projects ?? []).filter((project) =>
    project.items.some((item) => item.sourceUrl === sourceUrl),
  )

  return holding.length === 1 ? holding[0].publicId : undefined
}

export function SearchResultsList({
  response,
  city,
  searchSlug,
}: {
  response: PermitSearchResponse
  // The search's slug, so the editor can link back to it.
  searchSlug: string
  // The searched city, given to projects started from a result.
  city: { name: string; region: string }
}) {
  const { user } = useAuth()
  // For "Saved in" beside the PDFs already in a project.
  const { projects } = useAccountProjects(Boolean(user))

  return (
    <>
      <OnlineApplications response={response} city={city} searchSlug={searchSlug} />

      {/* In a city with a permit portal, the web results are the second
          part: forms and handouts, and PDFs as the alternative. */}
      {response.portal && response.results.length > 0 && (
        <p className="mt-8 text-xs font-medium tracking-[0.16em] text-ink/70 uppercase">
          Forms and pages
        </p>
      )}

      {response.isGeneralFallback && (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          We couldn’t find a page specific to this project. These are the city’s
          general permit pages, where you can find the permits it needs and
          apply.
        </p>
      )}

      {response.results.length > 0 ? (
        <ol
          className={`divide-y divide-ink/20 border-t border-ink ${
            response.portal ? 'mt-2' : 'mt-6'
          }`}
        >
          {response.results.map((searchResult) => (
            <li key={searchResult.url} className="py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium tracking-[0.08em] text-ink/60 uppercase">
                  {searchResult.domain}
                </span>
                {searchResult.isGovernmentSource && (
                  <span
                    className="-ml-1 inline-flex text-blueprint/75"
                    title="Official government website"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                      />
                    </svg>
                    <span className="sr-only">Official government website</span>
                  </span>
                )}
                {searchResult.isStateSource && (
                  <span className="rounded-full bg-blueprint/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-blueprint uppercase">
                    State of {city.region}
                  </span>
                )}
                {isPdf(searchResult) && (
                  <span className="rounded-full bg-redline/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-redline uppercase">
                    PDF
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg leading-6 font-medium text-ink">
                {/* Only the title opens the source, so the actions below
                    can't be mistaken for part of the link. */}
                <a
                  className="group/title rounded-xs underline-offset-2 hover:text-blueprint hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
                  href={searchResult.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {searchResult.title}
                  <svg
                    aria-hidden="true"
                    className="ml-1 inline size-4 align-[-0.125em] text-ink/50 transition group-hover/title:text-blueprint"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 17 17 7M8 7h9v9"
                    />
                  </svg>
                </a>
              </h2>
              <p className="mt-1 break-all text-xs leading-5 text-ink/50">
                {searchResult.url}
              </p>
              <p className="mt-2 line-clamp-3 text-base leading-6 text-ink/70">
                {searchResult.description}
              </p>
              {searchResult.isStateSource && (
                <p className="mt-1 text-sm text-ink/60">
                  This is a state page. Some cities run this permit themselves,
                  so check with {city.name} before you apply.
                </p>
              )}

              {isPdf(searchResult) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
                  <Link
                    className={`mr-2 ${rowPrimaryButtonClass}`}
                    search={{
                      url: searchResult.url,
                      project: onlyProjectHolding(searchResult.url, projects),
                      from: originParam({ kind: 'search', slug: searchSlug }),
                    }}
                    to="/editor"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                      />
                    </svg>
                    Fill out form
                  </Link>
                  <SavePermitButton
                    sourceUrl={searchResult.url}
                    title={searchResult.title}
                    city={city}
                    searchSlug={searchSlug}
                  />
                  <AddToProjectButton
                    city={city}
                    item={{
                      sourceUrl: searchResult.url,
                      title: searchResult.title,
                      searchSlug,
                    }}
                  />
                  <SavedIn
                    projects={(projects ?? []).filter((project) =>
                      project.items.some(
                        (item) => item.sourceUrl === searchResult.url,
                      ),
                    )}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          {response.onlineApplications?.length
            ? 'No other forms or pages turned up for this project. Start with the online permits above.'
            : 'No forms or pages turned up for this project. Try describing it another way, or contact the city’s permit office.'}
        </p>
      )}
    </>
  )
}

// Links to the projects a PDF is already in: the first by name, then a count.
function SavedIn({ projects }: { projects: Array<Project> }) {
  const [first, ...others] = projects

  if (!first) return null

  return (
    <span className="ml-2 flex min-w-0 items-center gap-1.5 text-sm text-ink/60">
      <span className="shrink-0">Saved in</span>
      <Link
        to="/projects/$projectId"
        params={{ projectId: first.publicId }}
        className="truncate font-medium text-ink underline-offset-2 hover:underline"
      >
        {first.name}
      </Link>
      {others.length > 0 && (
        <Link
          to="/projects"
          className="shrink-0 underline-offset-2 hover:underline"
        >
          +{others.length}
        </Link>
      )}
    </span>
  )
}
