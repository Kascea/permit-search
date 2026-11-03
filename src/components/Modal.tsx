import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  label: string
  // Panel width; the search form needs more room than a short message.
  widthClass?: string
  onClose: () => void
  // Rendered only while open, so each opening starts fresh.
  children: ReactNode
}

// A centered modal over a dimmed page. A native <dialog> handles focus
// trapping and closing with Escape; the children draw the panel itself.
export function Modal({
  isOpen,
  label,
  widthClass = 'max-w-160',
  onClose,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      // overflow-visible lets dropdowns, such as city suggestions, extend past
      // the panel.
      className={`search-modal m-auto w-[calc(100%-2rem)] ${widthClass} overflow-visible bg-transparent p-0 backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]`}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      {isOpen && children}
    </dialog>
  )
}

// The panel style shared by every modal.
export const modalPanelClass =
  'border border-ink p-5 shadow-[0_24px_64px_-24px_rgb(48_45_45/0.5)] sm:p-6'

export function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      className="grid size-8 shrink-0 place-items-center rounded-full text-ink transition hover:bg-ink/10"
      onClick={onClick}
    >
      <svg
        aria-hidden="true"
        className="size-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )
}
