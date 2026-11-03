// Shared button looks, so the same action reads the same everywhere. See
// "Components" in DESIGN.md.

// The view's one main action, such as Save.
export const primaryButtonClass =
  'inline-flex shrink-0 items-center gap-2 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint disabled:cursor-wait disabled:opacity-80'

// A quiet companion to it, such as Cancel or Discard.
export const textButtonClass =
  'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:text-ink disabled:opacity-50'
