import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import type { DraftContent } from '#/lib/drafts/types'
import type { FormSchema } from '#/lib/forms/types'
import type { ExtraField } from '#/lib/projects/types'
import type { PermitSearchResponse } from '#/lib/search/types'
import type {
  PermitRequirements,
  PermitStatus,
  PortalTypeDetails,
} from '#/lib/portals/types'

export const contactsStatus = pgEnum('contacts_status', [
  'found',
  'partial',
  'not_found',
])

// A PDF form, or an application filed on a city's permit portal; see
// docs/online-applications-plan.md.
export const projectItemKind = pgEnum('project_item_kind', ['pdf', 'online'])

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
    // Random ID used in URLs, such as /search/results/k7Qm2xPz9aB4, so saved
    // searches can't be found by counting up.
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
    // The signed-in user who ran it; null for visitors. Cleared when the user
    // deletes their account or removes it from their history, so the request
    // still counts but is no longer tied to them.
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('search_requests_search_id').on(table.searchId),
    index('search_requests_user_requested_at').on(
      table.userId,
      table.requestedAt,
    ),
  ],
)

// A visitor's report that a saved search's results are wrong.
export const resultReports = pgTable(
  'result_reports',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    searchId: bigint('search_id', { mode: 'number' })
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    message: varchar('message', { length: 1000 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('result_reports_search_id').on(table.searchId)],
)

// Better Auth tables. Property names must match Better Auth's field names; the
// adapter finds each table by its plural export name (usePlural). IDs are
// Better Auth's random text IDs.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  ...timestamps,
})

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (table) => [index('sessions_user_id').on(table.userId)],
)

// One row per sign-in method linked to a user: a password ("credential") or a
// Google account.
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // The provider's ID for the user, such as Google's "sub".
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    // Scrypt hash, set only on "credential" accounts.
    password: text('password'),
    ...timestamps,
  },
  (table) => [index('accounts_user_id').on(table.userId)],
)

// Short-lived values such as OAuth state.
export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index('verifications_identifier').on(table.identifier)],
)

// Better Auth's rate limit counts, one row per client IP and auth endpoint.
// lastRequest is in milliseconds since the epoch.
export const rateLimits = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

// A signed-in user's saved progress on one PDF form; see DraftContent.
export const pdfDrafts = pgTable(
  'pdf_drafts',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    // Random ID used by the drafts page, so row IDs aren't exposed.
    publicId: varchar('public_id', { length: 16 }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // The PDF's original URL, as passed to /editor?url=.
    sourceUrl: varchar('source_url', { length: 2048 }).notNull(),
    // SHA-256 of the PDF bytes, so the editor can tell the city replaced it.
    sourceHash: char('source_hash', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    // The user's name for the draft, such as "Backyard fence – Edina", shown
    // in place of the form's title. Null until they rename it.
    name: varchar('name', { length: 120 }),
    content: jsonb('content').$type<DraftContent>().notNull(),
    // The saved search the form was first opened from, for linking back.
    searchId: bigint('search_id', { mode: 'number' }).references(
      () => searches.id,
      { onDelete: 'set null' },
    ),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('pdf_drafts_public_id').on(table.publicId),
    uniqueIndex('pdf_drafts_user_source').on(table.userId, table.sourceUrl),
    index('pdf_drafts_user_updated_at').on(table.userId, table.updatedAt),
  ],
)

// A signed-in user's group of PDF forms for one job, such as "Backyard fence".
export const projects = pgTable(
  'projects',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    // Random ID used by the browser, so row IDs aren't exposed.
    publicId: varchar('public_id', { length: 16 }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 120 }).notNull(),
    // The city of the work, such as the city of the search it was started from.
    cityName: varchar('city_name', { length: 100 }),
    cityRegion: varchar('city_region', { length: 100 }),

    // What nearly every permit application asks for; see ProjectDetails.
    // Null when not filled in.
    streetAddress: varchar('street_address', { length: 200 }),
    unit: varchar('unit', { length: 40 }),
    zipCode: varchar('zip_code', { length: 10 }),
    parcelNumber: varchar('parcel_number', { length: 60 }),

    workDescription: varchar('work_description', { length: 2000 }),
    // Whole dollars.
    estimatedCost: integer('estimated_cost'),

    ownerName: varchar('owner_name', { length: 120 }),
    ownerPhone: varchar('owner_phone', { length: 40 }),
    ownerEmail: varchar('owner_email', { length: 254 }),
    ownerMailingAddress: varchar('owner_mailing_address', { length: 300 }),

    applicantIsOwner: boolean('applicant_is_owner').notNull().default(false),
    applicantName: varchar('applicant_name', { length: 120 }),
    applicantPhone: varchar('applicant_phone', { length: 40 }),
    applicantEmail: varchar('applicant_email', { length: 254 }),

    contractorCompany: varchar('contractor_company', { length: 200 }),
    contractorLicense: varchar('contractor_license', { length: 60 }),
    contractorPhone: varchar('contractor_phone', { length: 40 }),
    contractorEmail: varchar('contractor_email', { length: 254 }),

    // Fields the user added for answers their city's forms ask for.
    extraFields: jsonb('extra_fields')
      .$type<Array<ExtraField>>()
      .notNull()
      .default([]),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('projects_public_id').on(table.publicId),
    index('projects_user_updated_at').on(table.userId, table.updatedAt),
  ],
)

// A PDF in a project. Drafts are matched to it by source URL, so a PDF can sit
// in a project before anyone starts filling it out.
export const projectItems = pgTable(
  'project_items',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    projectId: bigint('project_id', { mode: 'number' })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    kind: projectItemKind('kind').notNull().default('pdf'),
    // A PDF's original URL, as passed to /editor?url=. For an online
    // application, its permit type's page_url, so every item is named by a
    // URL either way.
    sourceUrl: varchar('source_url', { length: 2048 }).notNull(),
    // The search result's title, such as "Fence Permit Application", or the
    // permit type's name.
    title: varchar('title', { length: 300 }).notNull(),
    // The saved search it was added from, for linking back.
    searchId: bigint('search_id', { mode: 'number' }).references(
      () => searches.id,
      { onDelete: 'set null' },
    ),
    // The permit type an online application applies for. Kept null-safe: a
    // type the catalog drops stays, but if its row were deleted the item
    // keeps its title and URL.
    portalPermitTypeId: bigint('portal_permit_type_id', {
      mode: 'number',
    }).references(() => portalPermitTypes.id, { onDelete: 'set null' }),
    // A supplemental PDF's online application, such as a form the city wants
    // uploaded with it.
    parentItemId: bigint('parent_item_id', { mode: 'number' }).references(
      (): AnyPgColumn => projectItems.id,
      { onDelete: 'cascade' },
    ),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('project_items_project_source').on(
      table.projectId,
      table.sourceUrl,
    ),
  ],
)

// A jurisdiction's permit-type catalog on a provider, such as St. Louis Park
// on LOGIS ePermits: when its list was last read, and when to read it again.
// See docs/search-flow-plan.md.
export const portalCatalogs = pgTable(
  'portal_catalogs',
  {
    // A key of PERMIT_PROVIDERS, such as "logis-epermits".
    provider: varchar('provider', { length: 40 }).notNull(),
    // The provider's code for the jurisdiction, such as "sl".
    jurisdiction: varchar('jurisdiction', { length: 80 }).notNull(),
    // Null until a read succeeds.
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    // The next search after this reads the list again.
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    typeCount: integer('type_count').notNull().default(0),
    // The last failed read's message, for logs; cleared on success.
    lastError: varchar('last_error', { length: 500 }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.provider, table.jurisdiction] })],
)

// One kind of application a jurisdiction accepts on its permit portal, such
// as "Residential - Deck" in St. Louis Park. Shared by every user and written
// only by provider adapters. Nothing here is specific to one provider; extras
// go in details.
export const portalPermitTypes = pgTable(
  'portal_permit_types',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    provider: varchar('provider', { length: 40 }).notNull(),
    jurisdiction: varchar('jurisdiction', { length: 80 }).notNull(),
    // The provider's own ID for the type, whatever its shape: "42" on LOGIS,
    // a GUID pair on EnerGov, "Building/Residential/Deck/NA" on Accela.
    externalId: varchar('external_id', { length: 200 }).notNull(),

    name: varchar('name', { length: 300 }).notNull(),
    // As the portal groups it, such as "Building -Residential (Plans
    // Required)". Null when the portal doesn't group types.
    category: varchar('category', { length: 300 }),
    // Null when the portal doesn't say.
    plansRequired: boolean('plans_required'),

    // A public page about this type. Required and unique per type, since it
    // names the type's project items; a provider without one uses its portal
    // page with the type's ID in the fragment.
    pageUrl: varchar('page_url', { length: 2048 }).notNull(),
    applyUrl: varchar('apply_url', { length: 2048 }),
    feeEstimatorUrl: varchar('fee_estimator_url', { length: 2048 }),

    // Null until read; refreshed when used after a day.
    requirements: jsonb('requirements').$type<PermitRequirements>(),
    requirementsFetchedAt: timestamp('requirements_fetched_at', {
      withTimezone: true,
    }),
    // Provider-specific extras that nothing generic reads.
    details: jsonb('details')
      .$type<PortalTypeDetails>()
      .notNull()
      .default({}),

    // When a catalog read last found it. Types the portal drops keep their
    // row for the project items that use them, but aren't matched.
    seenAt: timestamp('seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('portal_permit_types_external').on(
      table.provider,
      table.jurisdiction,
      table.externalId,
    ),
    uniqueIndex('portal_permit_types_page_url').on(table.pageUrl),
  ],
)

// The city permit filed for a form in a project, and its last known status.
// Hangs off project_items, so only forms in a project can be tracked, and it
// goes when the form leaves the project. One per form.
export const trackedPermits = pgTable(
  'tracked_permits',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    projectItemId: bigint('project_item_id', { mode: 'number' })
      .notNull()
      .references(() => projectItems.id, { onDelete: 'cascade' }),

    // A key of PERMIT_PROVIDERS, such as "logis-epermits". Text, so adding a
    // provider needs no migration.
    provider: varchar('provider', { length: 40 }).notNull(),
    // The provider's code for the city, such as "sl".
    jurisdiction: varchar('jurisdiction', { length: 40 }).notNull(),
    // Normalized by the provider's schema, such as "SL306008".
    permitNumber: varchar('permit_number', { length: 40 }).notNull(),

    // Null until the first successful check.
    status: jsonb('status').$type<PermitStatus>(),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    // When status last differed from the check before it.
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
    // The last check's failure, written for the user; cleared on success.
    checkError: varchar('check_error', { length: 300 }),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('tracked_permits_project_item').on(table.projectItemId),
  ],
)

// One version of a blank city form, named by the SHA-256 of its bytes. The
// bytes are in the BLANK_PDFS bucket at blank/<source_hash>.pdf. Shared by
// every user who saved it: it's a public form with no answers in it.
export const blankPdfs = pgTable('blank_pdfs', {
  sourceHash: char('source_hash', { length: 64 }).primaryKey(),
  byteSize: integer('byte_size').notNull(),
  pageCount: integer('page_count').notNull(),
  fieldCount: integer('field_count').notNull(),
  // The modification date written inside the PDF by whoever made it, if
  // any. Often the closest thing to the form's revision date.
  pdfModifiedAt: timestamp('pdf_modified_at', { withTimezone: true }),
  // When this version was first downloaded.
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// What a version of a form asks for: each field's label, section and role,
// and the checks it gets. Worked out once per version with Jev and shared by
// everyone who opens it, like blank_pdfs, but kept for any PDF opened in the
// editor, saved or not. Rebuilt when schema_version is older than
// FORM_SCHEMA_VERSION.
export const formSchemas = pgTable('form_schemas', {
  sourceHash: char('source_hash', { length: 64 }).primaryKey(),
  schemaVersion: integer('schema_version').notNull(),
  schema: jsonb('schema').$type<FormSchema>().notNull(),
  ...timestamps,
})

// A blank form in a user's library, such as "Fence Permit Application" for
// Minneapolis. Holds no answers, so it can go into any number of projects.
export const savedPermits = pgTable(
  'saved_permits',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    // Random ID used in URLs, such as /permits/Hn3pQ8rT2wXa.
    publicId: varchar('public_id', { length: 16 }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Where the city posts the form; checked again for newer versions. For
    // an online permit, its type's page_url, as in project_items.
    sourceUrl: varchar('source_url', { length: 2048 }).notNull(),
    // The stored copy of the version saved; see blankPdfs. Null for an
    // online permit.
    sourceHash: char('source_hash', { length: 64 }).references(
      () => blankPdfs.sourceHash,
    ),
    // An online permit's type in the portal catalog; null for a PDF. Types
    // are never deleted (see portalPermitTypes.seenAt).
    portalPermitTypeId: bigint('portal_permit_type_id', {
      mode: 'number',
    }).references(() => portalPermitTypes.id),
    title: varchar('title', { length: 300 }).notNull(),
    cityName: varchar('city_name', { length: 100 }).notNull(),
    cityRegion: varchar('city_region', { length: 100 }).notNull(),
    // As Jev named them for the search it was saved from.
    permitTypes: jsonb('permit_types').$type<Array<string>>().notNull(),
    // The saved search it was saved from, for linking back.
    searchId: bigint('search_id', { mode: 'number' }).references(
      () => searches.id,
      { onDelete: 'set null' },
    ),
    notes: varchar('notes', { length: 2000 }).notNull().default(''),

    // When the stored copy was last downloaded from the city's link: the
    // save for now, and later each automatic refresh.
    versionSavedAt: timestamp('version_saved_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // createdAt is when the user saved it.
    ...timestamps,
  },
  (table) => [
    uniqueIndex('saved_permits_public_id').on(table.publicId),
    uniqueIndex('saved_permits_user_source').on(table.userId, table.sourceUrl),
    // Each saved permit is either a PDF or an online permit.
    check(
      'saved_permits_pdf_or_online',
      sql`(${table.sourceHash} is null) <> (${table.portalPermitTypeId} is null)`,
    ),
    index('saved_permits_user_city_title').on(
      table.userId,
      table.cityRegion,
      table.cityName,
      table.title,
    ),
  ],
)

export type City = typeof cities.$inferSelect

export type CityOffice = typeof cityOffices.$inferSelect

export type Search = typeof searches.$inferSelect
