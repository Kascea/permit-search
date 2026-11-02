import { Link } from '@tanstack/react-router'

import { isPdfUrl } from '#/lib/pdf/url'
import type { PermitSearchResponse } from '#/lib/search/types'

export function SearchResultsList({
  response,
}: {
  response: PermitSearchResponse
}) {
  return (
    <>
      {response.isGeneralFallback && (
        <p className="mt-6 border-t border-[#302d2d] pt-5 text-sm leading-6 text-[#302d2d]/70">
          We couldn’t find a page specific to this project. These are the city’s
          general permit pages, where you can find the permits it needs and
          apply.
        </p>
      )}

      {response.results.length > 0 ? (
        <ol className="mt-6 divide-y divide-[#302d2d]/20 border-t border-[#302d2d]">
          {response.results.map((searchResult) => (
            <li key={searchResult.url}>
              <div className="group py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium tracking-[0.08em] text-[#302d2d]/60 uppercase">
                        {searchResult.domain}
                      </span>
                      {searchResult.isGovernmentSource && (
                        <span className="rounded-full bg-[#1968b4]/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-[#1968b4] uppercase">
                          Government
                        </span>
                      )}
                      {isPdfUrl(searchResult.url) && (
                        <span className="rounded-full bg-[#953012]/10 px-2 py-0.5 text-[0.65rem] font-medium tracking-[0.08em] text-[#953012] uppercase">
                          PDF
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg leading-6 font-medium text-[#302d2d] group-hover:text-[#1968b4]">
                      <a
                        href={searchResult.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {searchResult.title}
                      </a>
                    </h2>
                    <p className="mt-1 break-all text-xs leading-5 text-[#1968b4]">
                      {searchResult.url}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#302d2d]/70">
                      {searchResult.description}
                    </p>
                  </div>
                  <svg
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-[#302d2d]/50 transition group-hover:translate-x-0.5 group-hover:text-[#1968b4]"
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
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      className="inline-flex items-center rounded-full bg-[#1968b4] px-4 py-2 text-sm font-medium text-[#fdfff1] transition hover:bg-[#145390] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1968b4]"
                      search={{ url: searchResult.url }}
                      to="/editor"
                    >
                      Open in editor
                    </Link>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 border-t border-[#302d2d] pt-5 text-sm leading-6 text-[#302d2d]/70">
          No useful sources were found. Try a broader project description or
          verify the city name.
        </p>
      )}
    </>
  )
}
