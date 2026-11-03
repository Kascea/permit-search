import { Link } from '@tanstack/react-router'

import { AddToProjectButton } from '#/components/AddToProjectDialog'
import { useAuth } from '#/lib/auth/use-auth'
import { useAccountProjects } from '#/lib/projects/use-account-projects'
import { originParam } from '#/lib/navigation/origin'
import { isPdfUrl } from '#/lib/pdf/url'
import type { Project } from '#/lib/projects/types'
import type { PermitSearchResponse } from '#/lib/search/types'

export function SearchResultsList({
  response,
  city,
  searchId,
}: {
  response: PermitSearchResponse
  // The saved search's public ID, so the editor can link back to it.
  searchId: string
  // The searched city, given to projects started from a result.
  city: { name: string; region: string }
}) {
  const { user } = useAuth()
  // For "Saved in" beside the PDFs already in a project.
  const { projects } = useAccountProjects(Boolean(user))

  return (
    <>
      {response.isGeneralFallback && (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          We couldn’t find a page specific to this project. These are the city’s
          general permit pages, where you can find the permits it needs and
          apply.
        </p>
      )}

      {response.results.length > 0 ? (
        <ol className="mt-6 divide-y divide-ink/20 border-t border-ink">
          {response.results.map((searchResult) => (
            <li key={searchResult.url}>
              {/* The title link stretches over the whole card, so anywhere on
                  it opens the source. The editor link sits above it. */}
              <div className="group relative -mx-3 rounded-xs px-3 py-5 transition hover:bg-ink/[0.04]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium tracking-[0.08em] text-ink/60 uppercase">
                        {searchResult.domain}
                      </span>
                      {searchResult.isGovernmentSource && (
                        <span className="rounded-full bg-blueprint/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-blueprint uppercase">
                          Government
                        </span>
                      )}
                      {isPdfUrl(searchResult.url) && (
                        <span className="rounded-full bg-redline/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-redline uppercase">
                          PDF
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg leading-6 font-medium text-ink group-hover:text-blueprint">
                      <a
                        className="after:absolute after:inset-0 after:rounded-xs focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-blueprint"
                        href={searchResult.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {searchResult.title}
                      </a>
                    </h2>
                    <p className="mt-1 break-all text-xs leading-5 text-blueprint underline-offset-2 group-hover:underline">
                      {searchResult.url}
                    </p>
                    <p className="mt-2 line-clamp-3 text-base leading-6 text-ink/70">
                      {searchResult.description}
                    </p>
                  </div>
                  <svg
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-ink/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blueprint"
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
                </div>

                {isPdfUrl(searchResult.url) && (
                  // Actions for PDFs, labeled rather than icons beside the
                  // arrow, and raised above the card link.
                  <div className="relative z-10 mt-3 flex w-fit flex-wrap items-center gap-x-6 gap-y-2">
                    <Link
                      className="group/edit inline-flex items-center gap-2 rounded-full text-sm font-medium text-blueprint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint"
                      search={{
                        url: searchResult.url,
                        from: originParam({ kind: 'search', id: searchId }),
                      }}
                      to="/editor"
                    >
                      <span className="grid size-8 place-items-center rounded-full border border-blueprint/40 bg-blueprint/10 transition group-hover/edit:border-blueprint group-hover/edit:bg-blueprint group-hover/edit:text-paper">
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
                      </span>
                      <span className="underline-offset-2 group-hover/edit:underline">
                        Fill out this form
                      </span>
                    </Link>
                    <AddToProjectButton
                      city={city}
                      item={{
                        sourceUrl: searchResult.url,
                        title: searchResult.title,
                        searchId,
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
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 border-t border-ink pt-5 text-base leading-6 text-ink/70">
          No useful sources were found. Try a broader project description or
          verify the city name.
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
    <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink/60">
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
