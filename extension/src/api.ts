import { z } from 'zod'

import type { WebFieldInput } from '#/lib/forms/web-fields'
import type { Project } from '#/lib/projects/types'

export const SITE_URL =
  import.meta.env.VITE_PERMIT_SEARCH_URL ?? 'https://permitsearch.app'

export class SignedOutError extends Error {}

// What the routes send back on an error.
export const errorBodySchema = z.object({ error: z.string() })

// Calls the site's extension API with the site's session cookie. Chrome sends
// it because the extension has host permission for the site.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SITE_URL}/api/extension/${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (response.status === 401) throw new SignedOutError('Sign in to continue.')

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = errorBodySchema.safeParse(body)

    throw new Error(
      error.success ? error.data.error : 'Permit Search couldn’t be reached.',
    )
  }

  // SAFETY: the routes in src/routes/api.extension.*.ts return these shapes.
  return body as T
}

export interface ExtensionUser {
  name: string
  email: string
}

export async function getSession() {
  return (await request<{ user: ExtensionUser }>('session')).user
}

export async function getProjects() {
  return (await request<{ projects: Array<Project> }>('projects')).projects
}

export async function findFields(input: {
  projectId: string
  title: string
  fields: Array<WebFieldInput>
  optionIds: Array<string>
}) {
  return (
    await request<{ matches: Array<{ boxName: string; optionId: string }> }>(
      'find-fields',
      { method: 'POST', body: JSON.stringify(input) },
    )
  ).matches
}
