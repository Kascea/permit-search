import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { SignInButton } from '#/components/SignInDialog'
import { useAuth } from '#/lib/auth/use-auth'
import { errorMessage } from '#/lib/errors'
import { saveAccountPermit } from '#/lib/permits/permits'
import {
  putSavedPermit,
  useSavedPermits,
} from '#/lib/permits/use-saved-permits'

const BOOKMARK_ICON =
  'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z'

const actionClass =
  'group/save inline-flex items-center gap-2 rounded-full text-sm font-medium text-blueprint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'

// The labeled "Save permit" action on a PDF search result: keeps a blank copy
// of the form in My permits. Once saved it links to the saved permit.
export function SavePermitButton({
  sourceUrl,
  title,
  city,
  searchId,
}: {
  sourceUrl: string
  title: string
  city: { name: string; region: string }
  searchId: string
}) {
  const { user } = useAuth()
  const permits = useSavedPermits(Boolean(user))
  const [isSaving, setIsSaving] = useState(false)
  const saved = permits?.find((permit) => permit.sourceUrl === sourceUrl)

  if (!user) {
    return (
      <SignInButton className={actionClass}>
        <SaveLabel label="Save permit" />
      </SignInButton>
    )
  }

  if (saved) {
    return (
      <Link
        to="/permits/$permitId"
        params={{ permitId: saved.publicId }}
        className={actionClass}
      >
        <SaveLabel label="Saved" isSaved />
      </Link>
    )
  }

  async function save() {
    setIsSaving(true)

    try {
      const permit = await saveAccountPermit({
        data: { sourceUrl, title, city, searchId },
      })

      putSavedPermit(permit)
      toast.success('Saved to My permits.')
    } catch (error) {
      toast.error(
        errorMessage(error, 'The permit couldn’t be saved. Try again.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <button
      type="button"
      disabled={isSaving || !permits}
      className={`${actionClass} disabled:cursor-wait disabled:opacity-60`}
      onClick={() => void save()}
    >
      <SaveLabel label={isSaving ? 'Saving…' : 'Save permit'} />
    </button>
  )
}

function SaveLabel({
  label,
  isSaved = false,
}: {
  label: string
  isSaved?: boolean
}) {
  return (
    <>
      <span
        className={`grid size-8 place-items-center rounded-full border transition ${
          isSaved
            ? 'border-blueprint bg-blueprint text-paper'
            : 'border-blueprint/40 bg-blueprint/10 group-hover/save:border-blueprint group-hover/save:bg-blueprint group-hover/save:text-paper'
        }`}
      >
        <svg
          aria-hidden="true"
          className="size-4"
          fill={isSaved ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={BOOKMARK_ICON} />
        </svg>
      </span>
      <span className="underline-offset-2 group-hover/save:underline">
        {label}
      </span>
    </>
  )
}
