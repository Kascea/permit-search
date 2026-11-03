import { useId, useState } from 'react'

import { errorMessage } from '#/lib/errors'
import { Modal, ModalCloseButton, modalPanelClass } from '#/components/Modal'
import { reportResults } from '#/lib/reports/reports'
import { Notice } from '#/components/Notice'

interface ReportDialogProps {
  isOpen: boolean
  searchId: string
  onClose: () => void
}

// Lets a visitor tell us a saved search's results are wrong. The message is
// stored against the search's public ID.
export function ReportDialog({ isOpen, searchId, onClose }: ReportDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      label="Report incorrect results"
      widthClass="max-w-[440px]"
      onClose={onClose}
    >
      <ReportForm searchId={searchId} onClose={onClose} />
    </Modal>
  )
}

function ReportForm({ searchId, onClose }: Omit<ReportDialogProps, 'isOpen'>) {
  const messageId = useId()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [status, setStatus] = useState<'editing' | 'sending' | 'sent'>(
    'editing',
  )

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!message.trim()) {
      setError('Tell us what’s wrong with the results.')

      return
    }

    setError('')
    setStatus('sending')

    try {
      await reportResults({ data: { publicId: searchId, message } })
      setStatus('sent')
    } catch (reportError) {
      setStatus('editing')
      setError(
        errorMessage(reportError, 'Your report couldn’t be sent. Try again.'),
      )
    }
  }

  if (status === 'sent') {
    return (
      <div className={`bg-paper ${modalPanelClass}`} role="status">
        <p className="text-lg font-medium text-ink">Thanks for the report.</p>
        <p className="mt-2 text-base leading-6 text-ink/70">
          We’ll review these results and fix what’s wrong.
        </p>
        <button
          type="button"
          className="mt-6 rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <form
      className={`bg-paper ${modalPanelClass}`}
      noValidate
      onSubmit={submitReport}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <label className="text-lg font-medium text-ink" htmlFor={messageId}>
          What’s wrong with these results?
        </label>
        <ModalCloseButton onClick={onClose} />
      </div>
      <textarea
        id={messageId}
        className="field-input min-h-32 resize-none"
        maxLength={1000}
        placeholder="e.g. A link is for a different city, or a page no longer exists"
        value={message}
        onChange={(event) => {
          setMessage(event.target.value)
          setError('')
        }}
      />

      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-xs tracking-[0.08em] text-ink/60 uppercase">
          Search {searchId}
        </span>
        <button
          type="submit"
          className="rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint disabled:cursor-wait disabled:opacity-60"
          disabled={status === 'sending'}
        >
          {status === 'sending' ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  )
}
