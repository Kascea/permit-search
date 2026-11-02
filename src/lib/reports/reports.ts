import { createServerFn } from '@tanstack/react-start'

import { saveResultReport } from '#/lib/reports/reports.server'

interface ReportInput {
  publicId: string
  message: string
}

export const reportResults = createServerFn({ method: 'POST' })
  .validator((input: ReportInput): ReportInput => {
    const message = input.message.trim()
    if (!/^[A-Za-z0-9]{8,16}$/.test(input.publicId)) {
      throw new Error('That search link is not valid.')
    }
    if (!message) {
      throw new Error('Tell us what’s wrong with the results.')
    }
    if (message.length > 1000) {
      throw new Error('Keep your message under 1,000 characters.')
    }
    return { publicId: input.publicId, message }
  })
  .handler(({ data }) => saveResultReport(data))
