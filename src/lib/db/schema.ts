import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

import type { PermitSearchResponse } from '#/lib/search/types'

export const contactsStatus = pgEnum('contacts_status', [
  'found',
  'partial',
  'not_found',
])

export const officeType = pgEnum('office_type', [
  'building',
  'zoning',
  'engineering',
  'general',
])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const cities = pgTable(
  'cities',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    // Normalized "st louis park|minnesota"; see cityKey().
    cityKey: varchar('city_key', { length: 220 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    region: varchar('region', { length: 100 }).notNull(),
    // Census place GEOID such as "2757220"; filled in later.
    censusGeoid: char('census_geoid', { length: 7 }),

    // The city's main permits page, saved from search results.
    permitsUrl: varchar('permits_url', { length: 2048 }),
    // The online permit application site, such as ePermits.
    portalUrl: varchar('portal_url', { length: 2048 }),

    // Freshness of the last contact collection; null status = never collected.
    contactsStatus: contactsStatus('contacts_status'),
    contactsCheckedAt: timestamp('contacts_checked_at', { withTimezone: true }),
    // Contacts are refreshed on the next request after this date.
    expiresOn: date('expires_on', { mode: 'string' }),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('cities_city_key').on(table.cityKey),
    uniqueIndex('cities_census_geoid').on(table.censusGeoid),
    index('cities_expires_on').on(table.expiresOn),
  ],
)

export const cityOffices = pgTable(
  'city_offices',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    cityId: bigint('city_id', { mode: 'number' })
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),

    officeType: officeType('office_type').notNull(),
    // The office the contact card shows by default.
    isPrimary: boolean('is_primary').notNull().default(false),

    name: varchar('name', { length: 200 }),
    // Phone and hours are stored as the city writes them.
    phone: varchar('phone', { length: 40 }),
    email: varchar('email', { length: 254 }),
    streetAddress: varchar('street_address', { length: 300 }),
    hours: varchar('hours', { length: 300 }),
    // The page these details were taken from.
    sourceUrl: varchar('source_url', { length: 2048 }),

    // Hand-edited: refreshes leave this office alone.
    isLocked: boolean('is_locked').notNull().default(false),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('city_offices_city_type').on(table.cityId, table.officeType),
    index('city_offices_city_id').on(table.cityId),
  ],
)

export const searches = pgTable(
  'searches',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    // Random ID used in URLs, such as /results/k7Qm2xPz9aB4, so saved searches
    // can't be found by counting up.
    publicId: varchar('public_id', { length: 16 }).notNull(),

    cityId: bigint('city_id', { mode: 'number' })
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    // As typed, such as "Bathroom remodel!".
    permitQuery: varchar('permit_query', { length: 240 }).notNull(),
    // Lowercase, punctuation removed: "bathroom remodel".
    normalizedQuery: varchar('normalized_query', { length: 240 }).notNull(),
    // City key, normalized query, and pipeline version; see searchKey().
    queryKey: varchar('query_key', { length: 500 }).notNull(),
    // Bumped when the search flow changes so older results aren't reused.
    pipelineVersion: integer('pipeline_version').notNull(),

    permitTypes: jsonb('permit_types').$type<Array<string>>().notNull(),
    response: jsonb('response').$type<PermitSearchResponse>().notNull(),
    resultCount: integer('result_count').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Matching searches after this run fresh instead of reusing this one.
    reuseUntil: timestamp('reuse_until', { withTimezone: true }).notNull(),
    timesServed: integer('times_served').notNull().default(1),
    lastServedAt: timestamp('last_served_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('searches_public_id').on(table.publicId),
    index('searches_query_key_created_at').on(table.queryKey, table.createdAt),
    index('searches_city_id').on(table.cityId),
  ],
)

export const searchRequests = pgTable(
  'search_requests',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    searchId: bigint('search_id', { mode: 'number' })
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // True when a saved search was reused instead of running again.
    wasReused: boolean('was_reused').notNull(),
  },
  (table) => [index('search_requests_search_id').on(table.searchId)],
)

export type City = typeof cities.$inferSelect
export type CityOffice = typeof cityOffices.$inferSelect
export type Search = typeof searches.$inferSelect
