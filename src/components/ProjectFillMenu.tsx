import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { addToAccountProject } from '#/lib/projects/projects'
import type { Project } from '#/lib/projects/types'
import { setAccountProjects } from '#/lib/projects/use-account-projects'

interface ProjectFillMenuProps {
  // Undefined while loading.
  projects: Array<Project> | undefined
  // The project last filled from, or the one the editor was opened from.
  project: Project | undefined
  // Empty fields each project can fill, by public ID.
  fillCounts: Map<string, number>
  onFill: (project: Project) => void
  // The open PDF, so it can be added to the project.
  item: { sourceUrl: string; title: string }
}

// The editor's "Fill from project" menu: choosing a project fills the PDF's
// empty fields that it can match. Values it can't match are copied from the
// project's page, which each row links to.
export function ProjectFillMenu({
  projects,
  project,
  fillCounts,
  onFill,
  item,
}: ProjectFillMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function closeOnOutside(event: PointerEvent) {
      if (
        !(event.target instanceof Node && menuRef.current?.contains(event.target))
      ) {
        setIsOpen(false)
      }
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

  const fillCount = project ? (fillCounts.get(project.publicId) ?? 0) : 0

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
          className="absolute top-full right-0 z-50 mt-2 flex max-h-[min(70vh,30rem)] w-72 max-w-[calc(100vw-1.5rem)] flex-col rounded-xs border border-ink bg-paper text-sm"
        >
          {projects === undefined ? (
            <p className="flex items-center gap-2 px-4 py-4 text-ink/60">
              <span className="spinner size-4" />
              Loading your projects…
            </p>
          ) : projects.length === 0 ? (
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
              <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                {projects.map((each) => {
                  const count = fillCounts.get(each.publicId) ?? 0

                  return (
                    <li
                      key={each.publicId}
                      className="group/row flex items-center hover:bg-ink/5"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 flex-col items-start py-2 pr-2 pl-4 text-left"
                        onClick={() => {
                          onFill(each)
                          setIsOpen(false)
                        }}
                      >
                        <span
                          className={`w-full truncate ${
                            each.publicId === project?.publicId
                              ? 'font-medium text-blueprint'
                              : 'text-ink'
                          }`}
                        >
                          {each.name}
                        </span>
                        <span className="text-xs text-ink/60">
                          {count === 0
                            ? 'Nothing to fill'
                            : `Fills ${count} empty ${count === 1 ? 'field' : 'fields'}`}
                        </span>
                      </button>
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: each.publicId }}
                        aria-label={`Open ${each.name}`}
                        title="Open the project to copy its details"
                        className="mr-2 grid size-8 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-ink/10 hover:text-ink focus-visible:text-ink"
                      >
                        <svg
                          aria-hidden="true"
                          className="size-4"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          viewBox="0 0 24 24"
                        >
                          <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <p className="border-t border-ink/20 px-4 py-2.5 text-xs leading-5 text-ink/60">
                Only empty fields are filled. Check them before you download.
                {project && !isInProject && (
                  <>
                    {' '}
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
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
