import { useEffect, useId, useState } from 'react'

import { errorMessage } from '#/lib/errors'
import { Modal, ModalCloseButton, modalPanelClass } from '#/components/Modal'
import { SignInButton } from '#/components/SignInDialog'
import { useAuth } from '#/lib/auth/use-auth'
import { formatCity } from '#/lib/location/format'
import {
  addToAccountProject,
  createAccountProject,
  listAccountProjects,
  removeFromAccountProject,
} from '#/lib/projects/projects'
import {
  EMPTY_PROJECT_DETAILS,
  MAX_PROJECT_NAME_LENGTH,
} from '#/lib/projects/types'
import type { Project, ProjectItem } from '#/lib/projects/types'
import { setAccountProjects } from '#/lib/projects/use-account-projects'
import { Notice } from '#/components/Notice'

interface AddToProjectDialogProps {
  isOpen: boolean
  item: ProjectItem
  // The search's city, given to a project started here.
  city: { name: string; region: string } | null
  onClose: () => void
  // Called with the updated list after each change.
  onChange?: (projects: Array<Project>) => void
}

// Adds a PDF from the search results to one or more of the user's projects,
// or to a new one.
export function AddToProjectDialog({
  isOpen,
  item,
  city,
  onClose,
  onChange,
}: AddToProjectDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      label="Add to project"
      widthClass="max-w-[440px]"
      onClose={onClose}
    >
      <ProjectPicker
        item={item}
        city={city}
        onClose={onClose}
        onChange={onChange}
      />
    </Modal>
  )
}

function ProjectPicker({
  item,
  city,
  onClose,
  onChange,
}: Omit<AddToProjectDialogProps, 'isOpen'>) {
  const nameId = useId()
  const [projects, setProjects] = useState<Array<Project>>()
  const [busyId, setBusyId] = useState<string>()
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  function update(list: Array<Project>) {
    setProjects(list)
    onChange?.(list)
  }

  useEffect(() => {
    let isCurrent = true
    listAccountProjects()
      .then((list) => {
        if (isCurrent) setProjects(list ?? [])
      })
      .catch(() => {
        if (!isCurrent) return
        setProjects([])
        setError('Your projects couldn’t be loaded. Try again.')
      })

    return () => {
      isCurrent = false
    }
  }, [])

  // Shows the change at once, then settles on the server's list. A failure
  // puts the old list back.
  async function toggle(project: Project, isIn: boolean) {
    const before = projects
    setError('')
    setBusyId(project.publicId)
    setProjects(
      before?.map((each) =>
        each.publicId !== project.publicId
          ? each
          : {
              ...each,
              items: isIn
                ? each.items.filter(
                    (projectItem) => projectItem.sourceUrl !== item.sourceUrl,
                  )
                : [item, ...each.items],
            },
      ),
    )

    try {
      update(
        isIn
          ? await removeFromAccountProject({
              data: { publicId: project.publicId, sourceUrl: item.sourceUrl },
            })
          : await addToAccountProject({
              data: { publicId: project.publicId, item },
            }),
      )
    } catch {
      setProjects(before)
      setError('That project couldn’t be updated. Try again.')
    } finally {
      setBusyId(undefined)
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) {
      setError('Give the project a name.')

      return
    }

    setError('')
    setIsCreating(true)

    try {
      const created = await createAccountProject({
        data: {
          name,
          city,
          details: EMPTY_PROJECT_DETAILS,
          extraFields: [],
          item,
        },
      })

      update(created.projects)
      setName('')
    } catch (createError) {
      setError(
        errorMessage(
          createError,
          'The project couldn’t be created. Try again.',
        ),
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className={`bg-paper ${modalPanelClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-medium text-ink">Add to project</p>
          <p className="mt-0.5 truncate text-sm text-ink/60">{item.title}</p>
        </div>
        <ModalCloseButton onClick={onClose} />
      </div>

      {!projects ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-ink/60">
          <span className="spinner size-4" />
          Loading your projects…
        </div>
      ) : (
        projects.length > 0 && (
          <ul className="mt-5 divide-y divide-ink/20 border-t border-b border-ink">
            {projects.map((project) => {
              const isIn = project.items.some(
                (projectItem) => projectItem.sourceUrl === item.sourceUrl,
              )

              return (
                <li
                  key={project.publicId}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {project.name}
                    </p>
                    <p className="truncate text-sm text-ink/60">
                      {project.city ? `${formatCity(project.city)} · ` : ''}
                      {project.items.length}{' '}
                      {project.items.length === 1 ? 'form' : 'forms'}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={isIn}
                    disabled={busyId === project.publicId}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition disabled:cursor-wait ${
                      isIn
                        ? 'bg-success/10 text-success hover:bg-redline/10 hover:text-redline'
                        : 'border border-ink/40 text-ink hover:bg-ink hover:text-paper'
                    }`}
                    title={isIn ? 'Remove from this project' : undefined}
                    onClick={() => void toggle(project, isIn)}
                  >
                    {/* The list shows the change at once; the spinner stays
                        until the server confirms it. */}
                    {busyId === project.publicId && (
                      <span className="spinner size-3.5" role="status">
                        <span className="sr-only">Saving</span>
                      </span>
                    )}
                    {isIn ? 'Added' : 'Add'}
                  </button>
                </li>
              )
            })}
          </ul>
        )
      )}

      <form className="mt-5" noValidate onSubmit={create}>
        <label className="text-sm font-medium text-ink" htmlFor={nameId}>
          New project
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id={nameId}
            className="field-input py-2.5"
            maxLength={MAX_PROJECT_NAME_LENGTH}
            placeholder="e.g. Backyard fence"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
          />
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-blueprint px-5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint disabled:cursor-wait disabled:opacity-60"
          >
            {isCreating && (
              <span className="spinner size-3.5 border-paper/30 border-t-paper" />
            )}
            {isCreating ? 'Creating…' : 'Create'}
          </button>
        </div>
        {city && (
          <p className="mt-2 text-sm text-ink/60">In {formatCity(city)}</p>
        )}
      </form>

      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}
    </div>
  )
}

// The labeled "Add to project" action on a PDF search result. Signed-out
// visitors are asked to sign in first, since projects live in the account.
export function AddToProjectButton({
  item,
  city,
}: {
  item: ProjectItem
  city: { name: string; region: string } | null
}) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const label = (
    <>
      <span className="grid size-8 place-items-center rounded-full border border-blueprint/40 bg-blueprint/10 transition group-hover/project:border-blueprint group-hover/project:bg-blueprint group-hover/project:text-paper">
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
          />
        </svg>
      </span>
      <span className="text-sm underline-offset-2 group-hover/project:underline">
        Add to project
      </span>
    </>
  )

  const className =
    'group/project inline-flex items-center gap-2 rounded-full text-sm font-medium text-blueprint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'

  if (!user) {
    return <SignInButton className={className}>{label}</SignInButton>
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setIsOpen(true)}
      >
        {label}
      </button>
      <AddToProjectDialog
        isOpen={isOpen}
        item={item}
        city={city}
        onClose={() => setIsOpen(false)}
        // So the results' "Saved in" links update.
        onChange={setAccountProjects}
      />
    </>
  )
}
