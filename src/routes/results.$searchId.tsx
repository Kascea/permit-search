import { createFileRoute, redirect } from '@tanstack/react-router'

// Saved searches moved to /search/results/<id>; shared links still work.
export const Route = createFileRoute('/results/$searchId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/search/results/$searchId',
      params,
      statusCode: 301,
    })
  },
})
