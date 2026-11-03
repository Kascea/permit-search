import { Link } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { addToAccountProject } from '#/lib/projects/projects'
import {
  PROJECT_FIELD_GROUPS,
  PROJECT_TEXT_FIELDS,
  formatCost,
} from '#/lib/projects/types'
import type { Project } from '#/lib/projects/types'
import { setAccountProjects } from '#/lib/projects/use-account-projects'

interface ProjectFillMenuProps {
  // Undefined while loading.
  projects: Array<Project> | undefined
  // The project the menu fills from.
  project: Project | undefined
  onSelect: (publicId: string) => void
  // Empty fields the chosen project can fill.
  fillCount: number
  onFill: () => void
  // The open PDF, so it can be added to the project.
  item: { sourceUrl: string; title: string }
}

// The editor's "Fill from project" menu: fills the PDF's empty fields that it
// can match, and lists every project value with a copy button for the rest.
export function ProjectFillMenu({
  projects,
  project,
  onSelect,
  fillCount,
  onFill,
  item,
}: ProjectFillMenuProps) {
  const selectId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function closeOnOutside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  async function addToProject(target: Project) {
    setIsAdding(true)
    try {
      setAccountProjects(
        await addToAccountProject({
          data: { publicId: target.publicId, item },
        }),
      )
    } catch {
      toast.error('This form couldn’t be added to the project. Try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const isInProject =
    project?.items.some(({ sourceUrl }) => sourceUrl === item.sourceUrl) ??
    false

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
          isOpen
            ? 'border-blueprint bg-blueprint/10 text-blueprint'
            : 'border-ink/35 text-ink hover:border-ink'
        }`}
        onClick={() => setIsOpen((open) => !open)}
        title="Fill in this form from a project"
      >
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-blueprint"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
        <span className="hidden sm:inline">Fill from project</span>
        {fillCount > 0 && (
          <span className="rounded-full bg-blueprint px-1.5 text-[0.65rem] leading-4 text-paper tabular-nums">
            {fillCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Fill from project"
          className="absolute top-full right-0 z-50 mt-2 flex max-h-[min(70vh,560px)] w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-[2px] border border-ink bg-paper text-sm"
        >
          {projects === undefined ? (
            <p className="flex items-center gap-2 px-4 py-4 text-ink/60">
              <span className="spinner size-4" />
              Loading your projects…
            </p>
          ) : !project ? (
            <div className="px-4 py-4">
              <p className="leading-6 text-ink/70">
                Save the property’s address, the owner and the contractor in a
                project, and fill them into any form.
              </p>
              <Link
                to="/projects/new"
                className="mt-3 inline-flex rounded-full bg-blueprint px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
              >
                Start a project
              </Link>
            </div>
          ) : (
            <>
              <div className="border-b border-ink/20 px-4 py-3">
                {projects.length > 1 ? (
                  <>
                    <label
                      className="mb-1 block text-xs text-ink/60"
                      htmlFor={selectId}
                    >
                      Project
                    </label>
                    <select
                      id={selectId}
                      className="field-input py-1.5 text-sm"
                      value={project.publicId}
                      onChange={(event) => onSelect(event.target.value)}
                    >
                      {projects.map((each) => (
                        <option key={each.publicId} value={each.publicId}>
                          {each.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <p className="truncate font-medium text-ink">
                    {project.name}
                  </p>
                )}

                <button
                  type="button"
                  disabled={fillCount === 0}
                  className="mt-3 w-full rounded-full bg-blueprint px-4 py-2 text-sm font-medium text-paper transition hover:bg-blueprint-deep disabled:cursor-default disabled:bg-ink/15 disabled:text-ink/60"
                  onClick={() => {
                    onFill()
                    setIsOpen(false)
                  }}
                >
                  {fillCount === 0
                    ? 'No empty fields to fill'
                    : `Fill ${fillCount} empty ${fillCount === 1 ? 'field' : 'fields'}`}
                </button>
                <p className="mt-2 text-xs leading-5 text-ink/60">
                  Fields are matched by name and only empty ones are filled.
                  Check them before you download.
                </p>

                {!isInProject && (
                  <p className="mt-2 text-xs leading-5 text-ink/60">
                    This form isn’t in {project.name}.{' '}
                    <button
                      type="button"
                      disabled={isAdding}
                      className="font-medium text-blueprint underline-offset-2 hover:underline disabled:cursor-wait"
                      onClick={() => void addToProject(project)}
                    >
                      <span className="text-xs">
                        {isAdding ? 'Adding…' : 'Add it'}
                      </span>
                    </button>
                  </p>
                )}
              </div>

              <ProjectValues project={project} onCopy={copy} />

              <Link
                to="/projects/$projectId"
                params={{ projectId: project.publicId }}
                className="border-t border-ink/20 px-4 py-2.5 text-xs font-medium text-blueprint underline-offset-2 hover:underline"
              >
                Edit project details
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Every value the project holds, grouped, each with a copy button for fields
// the menu couldn't match.
function ProjectValues({
  project,
  onCopy,
}: {
  project: Project
  onCopy: (label: string, value: string) => void
}) {
  const { details, city } = project
  const groups = PROJECT_FIELD_GROUPS.map((group) => {
    const source =
      group.id === 'applicant' && details.applicantIsOwner ? 'owner' : group.id
    const rows = PROJECT_TEXT_FIELDS.filter(
      (field) =>
        field.group === source &&
        // The owner's mailing address isn't asked of the applicant.
        !(source !== group.id && field.key === 'ownerMailingAddress'),
    ).map((field) => ({ label: field.label, value: details[field.key] }))
    if (group.id === 'property' && city) {
      rows.unshift({ label: 'City', value: city.name })
      rows.splice(1, 0, { label: 'State', value: city.region })
    }
    if (group.id === 'work' && details.estimatedCost !== null) {
      rows.push({
        label: 'Estimated cost',
        value: formatCost(details.estimatedCost),
      })
    }
    return { title: group.title, rows: rows.filter((row) => row.value) }
  })
  groups.push({ title: 'Other details', rows: project.extraFields })
  const shown = groups.filter((group) => group.rows.length > 0)

  if (shown.length === 0) {
    return (
      <p className="px-4 py-4 text-ink/60">This project has no details yet.</p>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-1">
      {shown.map((group) => (
        <section key={group.title} className="px-4 py-2">
          <h3 className="text-[0.65rem] font-medium tracking-[0.12em] text-ink/60 uppercase">
            {group.title}
          </h3>
          <ul className="mt-1">
            {group.rows.map((row, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="group/copy -mx-2 flex w-[calc(100%+1rem)] items-baseline gap-3 rounded-[2px] px-2 py-1 text-left transition hover:bg-ink/5"
                  onClick={() => onCopy(row.label, row.value)}
                  title={`Copy ${row.label.toLowerCase()}`}
                >
                  <span className="w-24 shrink-0 truncate text-xs text-ink/60">
                    {row.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {row.value}
                  </span>
                  <span className="shrink-0 text-xs text-blueprint opacity-0 transition group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100">
                    Copy
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

async function copy(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied.`)
  } catch {
    toast.error('Your browser wouldn’t copy that.')
  }
}
