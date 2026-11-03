import { createServerFn } from '@tanstack/react-start'

import { findCityAt } from '#/lib/location/census.server'
import type { Coordinates } from '#/lib/location/types'
import { UserError } from '#/lib/errors'

// "Detect my city": the device's coordinates in, its municipality out. The
// coordinates are only passed to the Census geocoder, never stored.
export const locateCity = createServerFn({ method: 'POST' })
  .validator(validateCoordinates)
  .handler(({ data }) => findCityAt(data.latitude, data.longitude))

function validateCoordinates(input: Coordinates): Coordinates {
  const { latitude, longitude } = input
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new UserError(
      'Your location is unavailable. Enter your city instead.',
    )
  }
  return { latitude, longitude }
}
