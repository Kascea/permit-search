import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { addToAccountProject } from '#/lib/projects/projects'
import type { Project } from '#/lib/projects/types'
import { setAccountProjects } from '#/lib/projects/use-account-projects'

// One box Autofill filled.
export interface AutofillFill {
  fieldId: string
  pageIndex: number
  // The project field it came from, such as "Contractor phone".
  label: string
  value: string
}

export type AutofillState =
  | { status: 'filling'; projectName: string }
  | {
      status: 'done'
      projectName: string
      filled: Array<AutofillFill>
      // Labels of the project's values with no box on this form.
      notFound: Array<string>
      // Page numbers Jev couldn't read, or that were past the limit.
      failedPages: Array<number>
      skippedPages: Array<number>
    }

function pageList(pages: Array<number>) {
  return `${pages.length === 1 ? 'Page' : 'Pages'} ${pages.join(', ')}`
}

// Chooses a project, runs Autofill and shows what it filled and what it couldn't,
// beside the pages. Each filled field links to its box.
export function AutofillPanel({
  state,
  emptyBoxes,
  projects,
  project,
  item,
  onChoose,
  onFill,
  onUndo,
  onSelect,
}: {
  // Undefined before Autofill has run.
  state: AutofillState | undefined
  // Text boxes still empty.
  emptyBoxes: number
  // Undefined while loading.
  projects: Array<Project> | undefined
  // The project to fill from, if one's chosen or can be assumed.
  project: Project | undefined
  // The open PDF, so it can be added to the project.
  item: { sourceUrl: string; title: string }
  onChoose: (publicId: string) => void
  onFill: () => void
  onUndo: () => void
  onSelect: (fill: AutofillFill) => void
}) {
  const isFilling = state?.status === 'filling'

  return (
    <>
      <ProjectPicker
        projects={projects}
        project={project}
        item={item}
        disabled={isFilling}
        onChoose={onChoose}
      />
      {isFilling ? (
        <p className="flex items-center gap-3 px-4 py-6 text-sm text-ink/70">
          <span className="size-4 spinner" />
          Filling from “{state.projectName}”…
        </p>
      ) : state ? (
        <AutofillResults
          state={state}
          emptyBoxes={emptyBoxes}
          canFill={Boolean(project)}
          onFill={onFill}
          onUndo={onUndo}
          onSelect={onSelect}
        />
      ) : (
        project && (
          <div className="px-4 py-4 text-sm leading-6 text-ink/70">
            <p className="mb-3">
              Fills this form’s empty boxes. Boxes you’ve already filled stay as
              they are.
            </p>
            <FillButton onClick={onFill} />
          </div>
        )
      )}
    </>
  )
}

function FillButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="flex h-8 shrink-0 items-center rounded-full bg-blueprint px-3 text-xs font-medium whitespace-nowrap text-paper transition hover:bg-blueprint-deep"
      onClick={onClick}
      type="button"
    >
      Fill empty boxes
    </button>
  )
}

// Which project to fill from, with a link to it, and a way to add this form to
// it if it isn't there.
function ProjectPicker({
  projects,
  project,
  item,
  disabled,
  onChoose,
}: {
  projects: Array<Project> | undefined
  project: Project | undefined
  item: { sourceUrl: string; title: string }
  disabled: boolean
  onChoose: (publicId: string) => void
}) {
  const [isAdding, setIsAdding] = useState(false)

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

  if (projects === undefined) {
    return (
      <p className="flex shrink-0 items-center gap-2 px-4 py-4 text-sm text-ink/60">
        <span className="spinner size-4" />
        Loading your projects…
      </p>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="shrink-0 px-4 py-4">
        <p className="text-sm leading-6 text-ink/70">
          Save the property’s address, the owner and the contractor in a project,
          and fill them into any form.
        </p>
        <Link
          to="/projects/new"
          className="mt-3 inline-flex rounded-full bg-blueprint px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
        >
          Start a project
        </Link>
      </div>
    )
  }

  const isInProject =
    project?.items.some(({ sourceUrl }) => sourceUrl === item.sourceUrl) ??
    false

  return (
    <div className="shrink-0 border-b border-ink/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label
          className="text-xs font-medium text-ink/60"
          htmlFor="autofill-project"
        >
          Fill from
        </label>
        {project && (
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.publicId }}
            className="text-xs font-medium text-blueprint underline-offset-2 hover:underline"
          >
            Open project
          </Link>
        )}
      </div>
      <select
        className="mt-1.5 h-9 w-full rounded-xs border border-ink/35 bg-paper px-2 text-sm text-ink transition hover:border-ink disabled:opacity-50"
        disabled={disabled}
        id="autofill-project"
        onChange={(event) => onChoose(event.target.value)}
        value={project?.publicId ?? ''}
      >
        {!project && (
          <option disabled value="">
            Choose a project
          </option>
        )}
        {projects.map(({ publicId, name }) => (
          <option key={publicId} value={publicId}>
            {name}
          </option>
        ))}
      </select>
      {project && !isInProject && (
        <p className="mt-2 text-xs leading-5 text-ink/60">
          This form isn’t in {project.name}.{' '}
          <button
            className="font-medium text-blueprint underline-offset-2 hover:underline disabled:cursor-wait"
            disabled={isAdding}
            onClick={() => void addToProject(project)}
            type="button"
          >
            {isAdding ? 'Adding…' : 'Add it'}
          </button>
        </p>
      )}
    </div>
  )
}

// What the last Autofill filled and what it couldn't.
function AutofillResults({
  state,
  emptyBoxes,
  canFill,
  onFill,
  onUndo,
  onSelect,
}: {
  state: Extract<AutofillState, { status: 'done' }>
  emptyBoxes: number
  canFill: boolean
  onFill: () => void
  onUndo: () => void
  onSelect: (fill: AutofillFill) => void
}) {
  const { filled, notFound, failedPages, skippedPages } = state

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-4 pt-4 text-sm leading-6 font-medium text-ink">
          {filled.length === 0
            ? 'No fields filled'
            : `${filled.length} ${filled.length === 1 ? 'field' : 'fields'} filled`}{' '}
          from “{state.projectName}”.
        </p>

        {failedPages.length > 0 && (
          <p className="mt-3 flex items-center justify-between gap-3 bg-redline-wash px-4 py-2.5 text-xs leading-5 text-redline">
            {pageList(failedPages)} couldn’t be checked.
            <button
              className="shrink-0 font-medium underline underline-offset-2"
              onClick={onFill}
              type="button"
            >
              Try again
            </button>
          </p>
        )}

        {skippedPages.length > 0 && (
          <p className="mt-3 bg-redline-wash px-4 py-2.5 text-xs leading-5 text-redline">
            {pageList(skippedPages)} weren’t searched, as this form is long.
          </p>
        )}

        {filled.length > 0 && (
          <div className="mt-4">
            <GroupTitle title="Filled" count={filled.length} />
            <ul className="border-y border-ink">
              {filled.map((fill) => (
                <li
                  className="border-t border-ink/20 first:border-t-0"
                  key={fill.fieldId}
                >
                  <button
                    className="block w-full px-4 py-2.5 text-left transition hover:bg-ink/5"
                    onClick={() => onSelect(fill)}
                    type="button"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {fill.label}
                      </span>
                      <span className="shrink-0 text-xs text-ink/50">
                        Page {fill.pageIndex + 1}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm leading-5 text-ink/80">
                      {fill.value}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notFound.length > 0 && (
          <div className="mt-4 pb-4">
            <GroupTitle title="No box found" count={notFound.length} />
            <p className="px-4 pb-2 text-xs leading-5 text-ink/60">
              In your project, but with no clear box on this form.
            </p>
            <ul className="border-y border-ink">
              {notFound.map((label) => (
                <li
                  className="border-t border-ink/20 px-4 py-2 text-sm leading-5 text-ink/80 first:border-t-0"
                  key={label}
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-ink/20 px-4 py-3">
        <p className="text-xs leading-5 text-ink/60">
          {emptyBoxes} {emptyBoxes === 1 ? 'box is' : 'boxes are'} still empty,
          though not every box applies.
        </p>
        <div className="flex items-center justify-between gap-3">
          {canFill && <FillButton onClick={onFill} />}
          {filled.length > 0 && (
            <button
              className="shrink-0 text-xs font-medium whitespace-nowrap text-ink/70 underline-offset-2 hover:text-ink hover:underline"
              onClick={onUndo}
              type="button"
            >
              Undo autofill
            </button>
          )}
        </div>
        <p className="text-xs leading-5 text-ink/55">
          Some matches come from Jev, a model that can be wrong. Read the form
          over before you submit it.
        </p>
      </div>
    </>
  )
}

function GroupTitle({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="flex items-center justify-between px-4 pb-1.5 text-xs font-medium tracking-[0.16em] text-ink/60 uppercase">
      {title}
      <span className="tabular-nums">{count}</span>
    </h3>
  )
}
