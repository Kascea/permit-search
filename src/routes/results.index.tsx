import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

const oldSearchSchema = z.object({
  city: z.string().catch(''),
  region: z.string().catch(''),
  permit: z.string().catch(''),
  fresh: z.boolean().optional().catch(undefined),
})

// Search moved to /search/results; older links keep their query.
export const Route = createFileRoute('/results/')({
  validateSearch: oldSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/search/results', search, statusCode: 301 })
  },
})
