import { createServerFn } from '@tanstack/react-start'

import { saveResultReport } from '#/lib/reports/reports.server'
import { UserError } from '#/lib/errors'
import { rateLimited } from '#/lib/rate-limit'
import { isSearchSlug } from '#/lib/saved-searches/search-key'

interface ReportInput {
  slug: string
  message: string
}

export const reportResults = createServerFn({ method: 'POST' })
  .middleware([rateLimited])
  .validator((input: ReportInput): ReportInput => {
    const message = input.message.trim()

    if (!isSearchSlug(input.slug)) {
      throw new UserError('That search link is not valid.')
    }

    if (!message) {
      throw new UserError('Tell us what’s wrong with the results.')
    }

    if (message.length > 1000) {
      throw new UserError('Keep your message under 1,000 characters.')
    }

    return { slug: input.slug, message }
  })
  .handler(({ data }) => saveResultReport(data))
