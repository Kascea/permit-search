import { env } from 'cloudflare:workers'

import { UserError } from '#/lib/errors'

// Throws once a client has made more of one kind of request than the
// RATE_LIMITER binding allows in a minute. Cloudflare counts per location, so
// the limit is approximate: it's for stopping scripts, not people. Without a
// client IP, as in local development, nothing is limited.
export async function limitRequest(action: string, headers: Headers) {
  const ip = headers.get('cf-connecting-ip')

  if (!ip) return

  const { success } = await env.RATE_LIMITER.limit({ key: `${action}:${ip}` })

  if (!success) {
    throw new UserError('Too many requests. Wait a minute, then try again.')
  }
}
