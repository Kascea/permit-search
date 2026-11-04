import { useRouter } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { primaryButtonClass, textButtonClass } from '#/components/buttons'
import { Modal, ModalCloseButton, modalPanelClass } from '#/components/Modal'
import { Notice } from '#/components/Notice'
import { errorMessage } from '#/lib/errors'
import type { Project, ProjectItem } from '#/lib/projects/types'
import { setAccountProjects } from '#/lib/projects/use-account-projects'
import {
  PERMIT_PROVIDERS,
  findJurisdiction,
  isPermitProviderId,
  providerForCity,
} from '#/lib/tracking/providers'
import type { PermitProviderId } from '#/lib/tracking/providers'
import { setProjectFormPermit } from '#/lib/tracking/tracking'

interface PermitNumberDialogProps {
  // The form whose permit is being added; undefined while closed.
  item: ProjectItem | undefined
  project: Project
  onClose: () => void
}

// Adds or changes the city permit number for a form in a project, after the
// user has filed the form on the city's portal.
export function PermitNumberDialog({
  item,
  project,
  onClose,
}: PermitNumberDialogProps) {
  return (
    <Modal
      isOpen={item !== undefined}
      label="Permit number"
      widthClass="max-w-110"
      onClose={onClose}
    >
      {item && (
        <PermitNumberForm item={item} project={project} onClose={onClose} />
      )}
    </Modal>
  )
}

const PROVIDER_IDS = Object.keys(PERMIT_PROVIDERS).filter(isPermitProviderId)

// The provider and city to start with: the permit's own, else the ones
// covering the project's city, else the first provider and no city.
function initialChoice(item: ProjectItem, project: Project) {
  if (item.permit && isPermitProviderId(item.permit.provider)) {
    return { provider: item.permit.provider, code: item.permit.jurisdiction }
  }

  const covering = providerForCity(project.city)

  if (covering) {
    return { provider: covering.provider, code: covering.jurisdiction.code }
  }

  return { provider: PROVIDER_IDS[0] ?? 'logis-epermits', code: '' }
}

function PermitNumberForm({
  item,
  project,
  onClose,
}: {
  item: ProjectItem
  project: Project
  onClose: () => void
}) {
  const router = useRouter()
  const portalId = useId()
  const cityId = useId()
  const numberId = useId()
  const hintId = useId()

  const initial = initialChoice(item, project)
  const [provider, setProvider] = useState<PermitProviderId>(initial.provider)
  const [code, setCode] = useState(initial.code)
  const [number, setNumber] = useState(item.permit?.permitNumber ?? '')
  // Format errors wait for the first submit, so typing isn't scolded.
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const portal = PERMIT_PROVIDERS[provider]
  const jurisdiction = findJurisdiction(provider, code)

  const parsed = jurisdiction
    ? portal.permitNumberSchema(jurisdiction).safeParse(number)
    : undefined

  const formatError = !jurisdiction
    ? 'Choose the city that issued the permit.'
    : parsed && !parsed.success
      ? (parsed.error.issues[0]?.message ?? 'That permit number isn’t valid.')
      : ''

  const error = (isSubmitted && formatError) || saveError

  // The project's city, when this portal doesn't cover it.
  const uncoveredCity =
    project.city && !providerForCity(project.city) ? project.city : null

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitted(true)
    setSaveError('')

    if (formatError) return

    setIsSaving(true)

    try {
      const { projects, check } = await setProjectFormPermit({
        data: {
          publicId: project.publicId,
          sourceUrl: item.sourceUrl,
          permit: { provider, jurisdiction: code, permitNumber: number },
        },
      })

      setAccountProjects(projects)
      await router.invalidate()
      onClose()

      // Saving also checks the status, so say what it found.
      const saved = projects
        .find((candidate) => candidate.publicId === project.publicId)
        ?.items.find((candidate) => candidate.sourceUrl === item.sourceUrl)
        ?.permit

      if (check.kind === 'failed') {
        toast.error(`Permit number saved. ${check.message}`)
      } else {
        toast.success(
          check.status
            ? `Permit ${saved?.permitNumber ?? ''} saved: ${check.status.label}.`
            : 'Permit number saved.',
        )
      }
    } catch (cause) {
      setSaveError(
        errorMessage(cause, 'The permit number couldn’t be saved. Try again.'),
      )
      setIsSaving(false)
    }
  }

  return (
    <form
      className={`bg-paper ${modalPanelClass}`}
      noValidate
      onSubmit={save}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-ink">
            {item.permit ? 'Change permit number' : 'Add permit number'}
          </h2>
          <p className="mt-1 truncate text-sm text-ink/60">{item.title}</p>
        </div>
        <ModalCloseButton onClick={onClose} />
      </div>

      <label
        className="mt-5 block text-sm font-medium text-ink"
        htmlFor={portalId}
      >
        Permit portal
      </label>
      <select
        id={portalId}
        className="field-input mt-1.5"
        value={provider}
        onChange={(event) => {
          if (!isPermitProviderId(event.target.value)) return
          setProvider(event.target.value)
          setCode('')
        }}
      >
        {PROVIDER_IDS.map((id) => (
          <option key={id} value={id}>
            {PERMIT_PROVIDERS[id].name}
          </option>
        ))}
      </select>

      <label
        className="mt-4 block text-sm font-medium text-ink"
        htmlFor={cityId}
      >
        City
      </label>
      <select
        id={cityId}
        className="field-input mt-1.5"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      >
        <option value="" disabled>
          Choose a city
        </option>
        {portal.jurisdictions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.city.name}
          </option>
        ))}
      </select>
      {uncoveredCity && !code && (
        <p className="mt-1.5 text-sm text-ink/60">
          {uncoveredCity.name} isn’t on {portal.name}. Permit tracking covers
          only the cities listed.
        </p>
      )}

      <label
        className="mt-4 block text-sm font-medium text-ink"
        htmlFor={numberId}
      >
        Permit number
      </label>
      <input
        id={numberId}
        className="field-input mt-1.5 font-mono uppercase"
        aria-describedby={hintId}
        aria-invalid={Boolean(isSubmitted && formatError)}
        autoComplete="off"
        spellCheck={false}
        maxLength={60}
        placeholder={jurisdiction ? portal.placeholder(jurisdiction) : ''}
        value={number}
        onChange={(event) => {
          setNumber(event.target.value)
          setSaveError('')
        }}
      />
      <p id={hintId} className="mt-1.5 text-sm text-ink/60">
        The city gives you one once you’ve filed this form. It’s on your
        permit and in the city’s confirmation email.
        {jurisdiction && (
          <>
            {' '}
            Haven’t filed yet?{' '}
            <a
              href={portal.applyUrl(jurisdiction)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blueprint underline-offset-2 hover:underline"
            >
              Apply on {jurisdiction.city.name}’s {portal.name}
            </a>
          </>
        )}
      </p>

      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <button type="button" className={textButtonClass} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={primaryButtonClass} disabled={isSaving}>
          {isSaving ? 'Checking…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
