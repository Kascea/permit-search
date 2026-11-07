import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import { searches } from '#/lib/db/schema'

// A column of the run a search's page shows: its newest that found something,
// or its newest if none did. Null when no search has that slug. For keeping
// which search a draft, saved permit or project form came from.
export function searchRunColumn(column: AnyPgColumn, slug: string | undefined) {
  return sql`(
    select ${column} from ${searches}
    where ${searches.slug} = ${slug ?? null}
    order by ${searches.resultCount} > 0 desc, ${searches.createdAt} desc
    limit 1
  )`
}
