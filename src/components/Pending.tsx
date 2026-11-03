import type { ReactNode } from 'react'

// A button's label, or a spinner and what's happening while its action runs.
// onFill is for buttons filled with blue, where the spinner is light.
export function Pending({
  isPending,
  label,
  onFill = false,
  children,
}: {
  isPending: boolean
  label: string
  onFill?: boolean
  children: ReactNode
}) {
  if (!isPending) return children
  return (
    <>
      <span
        className={`spinner size-3.5 ${
          onFill ? 'border-paper/30 border-t-paper' : ''
        }`}
      />
      <span role="status">{label}</span>
    </>
  )
}
