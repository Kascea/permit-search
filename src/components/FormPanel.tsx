import type { ReactNode } from 'react'

export type FormPanelTab = 'autofill' | 'check'

// The panel beside the pages, shared by Autofill's results and the form check.
export function FormPanel({
  tab,
  onTab,
  onClose,
  children,
}: {
  tab: FormPanelTab
  onTab: (tab: FormPanelTab) => void
  onClose: () => void
  children: ReactNode
}) {
  const tabs: Array<{ id: FormPanelTab; label: string }> = [
    { id: 'autofill', label: 'Autofill' },
    { id: 'check', label: 'Check' },
  ]

  return (
    <section aria-label="Form tools" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-stretch justify-between gap-2 pr-2 pl-4 rule-b lg:h-16">
        <div className="flex items-stretch gap-4" role="tablist">
          {tabs.map(({ id, label }) => (
            <button
              aria-selected={tab === id}
              className={`border-b-2 text-sm font-medium transition ${
                tab === id
                  ? 'border-blueprint text-ink'
                  : 'border-transparent text-ink/60 hover:text-ink'
              }`}
              key={id}
              onClick={() => onTab(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          aria-label="Close panel"
          className="my-auto grid size-8 place-items-center rounded-xs text-ink transition hover:bg-ink/10"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>

      {children}
    </section>
  )
}
