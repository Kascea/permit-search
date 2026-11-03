import type {
  DraftCheckResult,
  FieldIssue,
  IssueSeverity,
} from '#/lib/forms/checks'

export type FormCheckState =
  | { status: 'checking' }
  | { status: 'failed'; message: string }
  // stale: the form was edited after this check ran.
  | { status: 'done'; result: DraftCheckResult; stale: boolean }

const GROUPS: Array<{ severity: IssueSeverity; title: string }> = [
  { severity: 'error', title: 'Likely mistakes' },
  { severity: 'missing', title: 'Missing' },
  { severity: 'review', title: 'Worth a look' },
]

// The results of checking a form, beside the pages. Each finding links to
// its field.
export function FormCheckPanel({
  state,
  onCheck,
  onClose,
  onSelect,
}: {
  state: FormCheckState
  onCheck: () => void
  onClose: () => void
  onSelect: (issue: FieldIssue) => void
}) {
  return (
    <section aria-label="Form check" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-4 rule-b lg:h-16">
        <h2 className="text-sm font-medium text-ink">Form check</h2>
        <button
          aria-label="Close form check"
          className="grid size-8 place-items-center rounded-xs text-ink transition hover:bg-ink/10"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status === 'checking' ? (
          <p className="flex items-center gap-3 px-4 py-6 text-sm text-ink/70">
            <span className="size-4 spinner" />
            Checking your entries…
          </p>
        ) : state.status === 'failed' ? (
          <div className="px-4 py-6 text-sm leading-6">
            <p className="text-redline">{state.message}</p>
            <button
              className="mt-3 font-medium text-blueprint underline-offset-2 hover:underline"
              onClick={onCheck}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <CheckResults
            result={state.result}
            stale={state.stale}
            onCheck={onCheck}
            onSelect={onSelect}
          />
        )}
      </div>

      <p className="shrink-0 px-4 py-3 text-xs leading-5 text-ink/55 border-t border-ink/20">
        Checked by Jev, a model that can be wrong. Read the form over before you
        submit it.
      </p>
    </section>
  )
}

function CheckResults({
  result,
  stale,
  onCheck,
  onSelect,
}: {
  result: DraftCheckResult
  stale: boolean
  onCheck: () => void
  onSelect: (issue: FieldIssue) => void
}) {
  const against = result.projectName ? ` against “${result.projectName}”` : ''

  return (
    <>
      {stale && (
        <p className="flex items-center justify-between gap-3 bg-redline-wash px-4 py-2.5 text-xs leading-5 text-redline">
          You’ve edited the form since this check.
          <button
            className="shrink-0 font-medium underline underline-offset-2"
            onClick={onCheck}
            type="button"
          >
            Check again
          </button>
        </p>
      )}

      <p className="px-4 pt-4 text-xs leading-5 text-ink/60">
        {result.checkedFields} {result.checkedFields === 1 ? 'field' : 'fields'}{' '}
        checked{against}.
      </p>

      {result.issues.length === 0 ? (
        <p className="px-4 py-4 text-sm leading-6 font-medium text-success">
          No problems found.
        </p>
      ) : (
        GROUPS.map(({ severity, title }) => {
          const issues = result.issues.filter(
            (issue) => issue.severity === severity,
          )

          if (issues.length === 0) return null

          return (
            <div className="mt-4" key={severity}>
              <h3 className="flex items-center justify-between px-4 pb-1.5 text-xs font-medium tracking-[0.16em] text-ink/60 uppercase">
                {title}
                <span className="tabular-nums">{issues.length}</span>
              </h3>
              <ul className="border-y border-ink">
                {issues.map((issue, index) => (
                  <li
                    className="border-t border-ink/20 first:border-t-0"
                    key={`${issue.check}-${index}`}
                  >
                    <button
                      className="block w-full px-4 py-2.5 text-left transition hover:bg-ink/5"
                      onClick={() => onSelect(issue)}
                      type="button"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`text-sm font-medium ${
                            severity === 'review' ? 'text-ink' : 'text-redline'
                          }`}
                        >
                          {issue.label}
                        </span>
                        <span className="shrink-0 text-xs text-ink/50">
                          Page {issue.pageIndex + 1}
                        </span>
                      </span>
                      {issue.section && (
                        <span className="block text-xs text-ink/55">
                          {issue.section}
                        </span>
                      )}
                      <span className="mt-0.5 block text-sm leading-5 text-ink/80">
                        {issue.message}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}
    </>
  )
}
