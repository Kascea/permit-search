import { Link } from '@tanstack/react-router'

import { searchRouteParams } from '#/lib/navigation/origin'
import type { SearchLink } from '#/lib/navigation/origin'

// "From Fence in Austin, Texas", linking to the saved search, in a row's
// detail line.
export function SearchLinkText({ search }: { search: SearchLink }) {
  return (
    <>
      From{' '}
      <Link
        to="/results/$citySlug/$querySlug"
        params={searchRouteParams(search.slug)}
        className="text-blueprint underline-offset-2 hover:underline"
      >
        {search.label}
      </Link>
    </>
  )
}
