import { z } from 'zod'

// A field on a city's online application, as the browser extension reads it
// from the page's HTML and sends it to find-fields. id: the extension's own ID
// for the element. name: its HTML name or id. nearby: the text of its row or
// cell, standing in for the line a PDF field is printed on.
export const webFieldSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(500),
  label: z.string().max(500),
  section: z.string().max(500),
  nearby: z.string().max(500),
  kind: z.enum(['text', 'select']),
})

export type WebFieldInput = z.infer<typeof webFieldSchema>
