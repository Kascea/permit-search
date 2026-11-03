import { Link } from '@tanstack/react-router'

import type { SearchLink } from '#/lib/navigation/origin'

// "From Fence in Austin, Texas", linking to the saved search, in a row's
// detail line.
export function SearchLinkText({ search }: { search: SearchLink }) {
  return (
    <>
      From{' '}
      <Link
        to="/results/$searchId"
        params={{ searchId: search.publicId }}
        className="text-blueprint underline-offset-2 hover:underline"
      >
        {search.label}
      </Link>
    </>
  )
}
