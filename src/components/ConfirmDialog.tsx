import { useSyncExternalStore } from 'react'

import { Modal, modalPanelClass } from '#/components/Modal'
import { textButtonClass } from '#/components/buttons'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  // Destructive actions, such as deleting, get a redline button.
  isDestructive?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (isConfirmed: boolean) => void
}

let pending: PendingConfirm | null = null
const listeners = new Set<() => void>()

function setPending(next: PendingConfirm | null) {
  pending = next
  listeners.forEach((listener) => listener())
}

// Asks the user to confirm an action in a modal, in place of window.confirm().
// Resolves true when they confirm and false when they cancel or close it.
// Needs <ConfirmHost /> mounted once, in the root layout.
export function confirm(options: ConfirmOptions): Promise<boolean> {
  // A newer question replaces one still open, which counts as cancelled.
  pending?.resolve(false)

  return new Promise((resolve) => {
    setPending({ ...options, resolve })
  })
}

function settle(isConfirmed: boolean) {
  const current = pending

  if (!current) {
    return
  }

  setPending(null)
  current.resolve(isConfirmed)
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function ConfirmHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  )

  return (
    <Modal
      isOpen={current !== null}
      label={current?.title ?? 'Confirm'}
      widthClass="max-w-110"
      onClose={() => settle(false)}
    >
      {current && (
        <div className={`bg-paper ${modalPanelClass}`} role="alertdialog">
          <p className="text-lg font-medium text-ink">{current.title}</p>
          {current.message && (
            <p className="mt-2 text-base leading-6 text-ink/70">
              {current.message}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className={textButtonClass}
              onClick={() => settle(false)}
            >
              {current.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              // The first focusable element would be Cancel; starting on the
              // action matches window.confirm, where Enter confirms.
              autoFocus
              className={`rounded-full px-5 py-2.5 text-sm font-medium text-paper transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                current.isDestructive
                  ? 'bg-redline hover:bg-redline/90 focus-visible:outline-redline'
                  : 'bg-blueprint hover:bg-blueprint-deep focus-visible:outline-blueprint'
              }`}
              onClick={() => settle(true)}
            >
              {current.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
