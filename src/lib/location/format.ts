import type { City } from '#/lib/location/types'

export function formatCity(city: Pick<City, 'name' | 'region'>) {
  return [city.name, city.region].filter(Boolean).join(', ')
}
