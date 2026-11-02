import {
  bigint,
  boolean,
  char,
  date,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

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

export type City = typeof cities.$inferSelect
export type CityOffice = typeof cityOffices.$inferSelect
