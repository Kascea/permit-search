import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { renameAccountDraft } from '#/lib/drafts/drafts'
import { MAX_DRAFT_NAME_LENGTH } from '#/lib/drafts/types'
import { errorMessage } from '#/lib/errors'

// A draft's name in a list, with a pencil to rename it in place. The form's
// own title is the placeholder, and clearing the name goes back to it. Enter
// or leaving the field saves; Escape cancels.
export function DraftName({
  publicId,
  name,
  formTitle,
  className = '',
}: {
  publicId: string
  name: string | undefined
  // The form's title, such as "Fence Permit Application".
  formTitle: string
  className?: string
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')
  // Shown while the list reloads with the new name.
  const [pendingName, setPendingName] = useState<string | null>()
  const shown = pendingName === undefined ? name : (pendingName ?? undefined)

  async function save() {
    setIsEditing(false)
    const next = value.trim()

    if (next === (shown ?? '')) return
    setPendingName(next || null)

    try {
      await renameAccountDraft({ data: { publicId, name: next } })
      await router.invalidate()
    } catch (error) {
      toast.error(
        errorMessage(error, 'The draft couldn’t be renamed. Try again.'),
      )
    } finally {
      setPendingName(undefined)
    }
  }

  if (isEditing) {
    return (
      <input
        aria-label="Draft name"
        autoFocus
        className={`${className} w-full min-w-0 border-b border-blueprint bg-transparent outline-none placeholder:text-ink/40`}
        maxLength={MAX_DRAFT_NAME_LENGTH}
        placeholder={formTitle}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()

          if (event.key === 'Escape') {
            setValue(shown ?? '')
            setIsEditing(false)
          }
        }}
      />
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <p className={`${className} truncate`}>{shown ?? formTitle}</p>
      <button
        type="button"
        aria-label={`Rename ${shown ?? formTitle}`}
        title="Rename"
        className="grid size-7 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-ink/10 hover:text-ink focus-visible:text-ink"
        onClick={() => {
          setValue(shown ?? '')
          setIsEditing(true)
        }}
      >
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
          />
        </svg>
      </button>
    </div>
  )
}
