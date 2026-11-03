// Shared button looks, so the same action reads the same everywhere. See
// "Components" in DESIGN.md.

// The view's one main action, such as Save.
export const primaryButtonClass =
  'inline-flex shrink-0 items-center gap-2 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint disabled:cursor-wait disabled:opacity-80'

// The main action on one row of a list, such as "Fill out form" on a search
// result. Outlined, so a list of them doesn't compete with the view's primary
// button.
export const rowPrimaryButtonClass =
  'inline-flex shrink-0 items-center gap-2 rounded-full border border-blueprint px-4 py-1.5 text-sm font-medium text-blueprint transition hover:bg-blueprint hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint'

// A secondary action beside it, such as Save or Add to project: an icon and a
// label, with a padded hit area that shades on hover.
export const quietActionClass =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink/75 transition hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint disabled:cursor-wait disabled:opacity-60'

// A quiet companion to it, such as Cancel or Discard.
export const textButtonClass =
  'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:text-ink disabled:opacity-50'
