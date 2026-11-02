import { eq, sql } from 'drizzle-orm'

import type { CollectedContacts } from '#/lib/contacts/collect.server'
import { OFFICE_PRIORITY, cityKey } from '#/lib/contacts/types'
import type { Database } from '#/lib/db/client.server'
import { cities, cityOffices } from '#/lib/db/schema'
import type { City, CityOffice } from '#/lib/db/schema'

const FOUND_TTL_DAYS = 30
const NOT_FOUND_TTL_DAYS = 7
const FAILED_RETRY_DAYS = 1

interface CityName {
  name: string
  region: string
}

export async function loadCity(
  db: Database,
  { name, region }: CityName,
): Promise<{ city: City; offices: Array<CityOffice> } | null> {
  const city = (
    await db
      .select()
      .from(cities)
      .where(eq(cities.cityKey, cityKey(name, region)))
  ).at(0)
  if (!city) {
    return null
  }
  const offices = await db
    .select()
    .from(cityOffices)
    .where(eq(cityOffices.cityId, city.id))
  return { city, offices }
}

export async function upsertCity(
  db: Database,
  { name, region }: CityName,
): Promise<City> {
  const [city] = await db
    .insert(cities)
    .values({ cityKey: cityKey(name, region), name, region })
    .onConflictDoUpdate({
      target: cities.cityKey,
      set: { name, region },
    })
    .returning()
  return city
}

export async function saveCollectedContacts(
  db: Database,
  cityId: number,
  collected: CollectedContacts,
) {
  const primaryType = OFFICE_PRIORITY.find((officeType) =>
    collected.offices.some((office) => office.officeType === officeType),
  )

  await db.transaction(async (tx) => {
    for (const office of collected.offices) {
      const values = {
        name: office.name,
        phone: office.phone,
        email: office.email,
        streetAddress: office.streetAddress,
        hours: office.hours,
        sourceUrl: office.sourceUrl,
        isPrimary: office.officeType === primaryType,
      }
      await tx
        .insert(cityOffices)
        .values({ cityId, officeType: office.officeType, ...values })
        .onConflictDoUpdate({
          target: [cityOffices.cityId, cityOffices.officeType],
          set: values,
          // Hand-edited offices are left alone.
          setWhere: eq(cityOffices.isLocked, false),
        })
    }

    await tx
      .update(cities)
      .set({
        portalUrl: collected.portalUrl ?? sql`${cities.portalUrl}`,
        contactsStatus: collected.status,
        contactsCheckedAt: new Date(),
        expiresOn: daysFromToday(
          collected.status === 'not_found'
            ? NOT_FOUND_TTL_DAYS
            : FOUND_TTL_DAYS,
        ),
      })
      .where(eq(cities.id, cityId))
  })
}

// Keeps the old contacts and retries on the next request after tomorrow.
export async function postponeRefresh(db: Database, cityId: number) {
  await db
    .update(cities)
    .set({ expiresOn: daysFromToday(FAILED_RETRY_DAYS) })
    .where(eq(cities.id, cityId))
}

export async function saveCityPermitsUrl(
  db: Database,
  city: CityName,
  permitsUrl: string,
) {
  const { id } = await upsertCity(db, city)
  await db.update(cities).set({ permitsUrl }).where(eq(cities.id, id))
}

export function isFresh(city: City) {
  return city.expiresOn !== null && city.expiresOn >= daysFromToday(0)
}

// A YYYY-MM-DD date in UTC, as the expires_on column stores it.
function daysFromToday(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
