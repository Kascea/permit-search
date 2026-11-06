import { env } from 'cloudflare:workers'
import { TypeSafeClient } from '@typesafe-ai/sdk'

const TYPESAFE_TIMEOUT_MS = 10_000

export function createTypeSafeClient(timeout = TYPESAFE_TIMEOUT_MS) {
  return new TypeSafeClient({
    apiKey: env.TYPESAFE_API_KEY.trim(),
    compression: false,
    timeout,
  })
}
