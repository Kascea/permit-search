import { env } from 'cloudflare:workers'
import { TypeSafeClient } from '@typesafe-ai/sdk'

const TYPESAFE_TIMEOUT_MS = 10_000

export function createTypeSafeClient() {
  return new TypeSafeClient({
    apiKey: env.TYPESAFE_API_KEY.trim(),
    compression: false,
    timeout: TYPESAFE_TIMEOUT_MS,
  })
}
