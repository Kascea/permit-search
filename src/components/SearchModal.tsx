import { useEffect, useRef } from 'react'

import { PermitSearchForm } from '#/components/PermitSearchForm'
import type { City } from '#/lib/location/types'

interface SearchModalProps {
  isOpen: boolean
  initialCity?: City
  initialPermit?: string
  onClose: () => void
  onSearch: (city: City, permit: string) => void
}

// The home page's search form in a dialog, for searching again from results.
// A native <dialog> handles focus trapping and closing with Escape.
export function SearchModal({
  isOpen,
  initialCity,
  initialPermit,
  onClose,
  onSearch,
}: SearchModalProps) {
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
      aria-labelledby="search-modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[640px] bg-transparent p-0 backdrop:bg-[#302d2d]/50"
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-[#fdfff1] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="search-modal-title"
            className="text-2xl font-medium tracking-[-0.02em] text-[#302d2d]"
          >
            New search
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="grid size-10 place-items-center rounded-full text-[#302d2d] transition hover:bg-[#302d2d]/10"
            onClick={onClose}
          >
            <svg
              aria-hidden="true"
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {/* Remounted on each open so it starts from the current search. */}
        {isOpen && (
          <PermitSearchForm
            initialCity={initialCity}
            initialPermit={initialPermit}
            onSearch={onSearch}
          />
        )}
      </div>
    </dialog>
  )
}
