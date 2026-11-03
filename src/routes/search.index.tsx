import { createFileRoute, redirect } from '@tanstack/react-router'

// Search starts from the header's search pill, or the landing page's form
// when signed out; past searches are on /history.
export const Route = createFileRoute('/search/')({
  beforeLoad: () => {
    throw redirect({ to: '/', statusCode: 301 })
  },
})
