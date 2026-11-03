import { useBlocker } from '@tanstack/react-router'
import { createContext, useContext, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { errorMessage } from '#/lib/errors'
import { primaryButtonClass, textButtonClass } from '#/components/buttons'
import { CityCombobox } from '#/components/CityCombobox'
import { Pending } from '#/components/Pending'
import { copyWithToast } from '#/lib/clipboard'
import { formatCity } from '#/lib/location/format'
import type { City } from '#/lib/location/types'
import {
  EMPTY_PROJECT_DETAILS,
  MAX_ESTIMATED_COST,
  MAX_EXTRA_FIELDS,
  MAX_EXTRA_LABEL_LENGTH,
  MAX_EXTRA_VALUE_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  PROJECT_TEXT_FIELDS,
  SUGGESTED_EXTRA_FIELDS,
} from '#/lib/projects/types'
import type {
  ExtraField,
  ProjectDetails,
  ProjectInput,
  ProjectTextKey,
} from '#/lib/projects/types'
import { Notice } from '#/components/Notice'

interface ProjectFormProps {
  // create: a submit button at the end. edit: always editable, with a save
  // bar pinned to the bottom of the window once something changes.
  variant: 'create' | 'edit'
  initial?: ProjectInput
  submitLabel: string
  pendingLabel: string
  // Throws to show the error by the save button.
  onSubmit: (input: ProjectInput) => Promise<void>
  onCancel?: () => void
  // So an input elsewhere on the page can join the form, with form={formId}.
  formId?: string
  // A name edited outside the form, such as in the page's title. It counts
  // toward unsaved changes and is saved and discarded with the rest.
  name?: string
  onNameChange?: (name: string) => void
}

interface FormFields {
  name: string
  // As typed; a city counts only once chosen from the list.
  cityInput: string
  selectedCity: City | undefined
  details: ProjectDetails
  // Typed as text so "$45,000" can be entered; parsed on submit.
  cost: string
  extraFields: Array<ExtraField>
}

function fieldsFrom(initial: ProjectInput | undefined): FormFields {
  const city = initial?.city
    ? { ...initial.city, country: 'United States' as const }
    : undefined
  return {
    name: initial?.name ?? '',
    cityInput: city ? formatCity(city) : '',
    selectedCity: city,
    details: initial?.details ?? EMPTY_PROJECT_DETAILS,
    cost: initial?.details.estimatedCost?.toLocaleString('en-US') ?? '',
    extraFields: initial?.extraFields ?? [],
  }
}

// Compared with the saved copy to tell whether there's anything to save.
function snapshotOf(fields: FormFields) {
  return JSON.stringify({
    ...fields,
    selectedCity: fields.selectedCity && formatCity(fields.selectedCity),
  })
}

const chipClass =
  'rounded-full border border-ink/40 px-3 py-1 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper'

// Everything a project holds, as compact editable tables. Only the name is
// required; the rest fills in forms later.
export function ProjectForm({
  variant,
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
  formId,
  name: outsideName,
  onNameChange,
}: ProjectFormProps) {
  const [ownFields, setFields] = useState(() => fieldsFrom(initial))
  const fields =
    outsideName === undefined ? ownFields : { ...ownFields, name: outsideName }
  // The last saved state; the form has changes when it differs.
  const [saved, setSaved] = useState(() => snapshotOf(fieldsFrom(initial)))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const { name, cityInput, selectedCity, details, cost, extraFields } = fields
  const isDirty = snapshotOf(fields) !== saved

  // Asks before leaving with unsaved changes, except for the navigation a
  // successful save makes.
  const isSubmittingRef = useRef(false)
  const shouldBlock = () => isDirty && !isSubmittingRef.current
  useBlocker({
    shouldBlockFn: () =>
      shouldBlock() &&
      !window.confirm('You have unsaved changes. Leave without saving?'),
    enableBeforeUnload: shouldBlock,
    withResolver: false,
  })

  function update(change: Partial<FormFields>) {
    setFields((current) => ({ ...current, ...change }))
    setError('')
  }

  function setDetail<TKey extends keyof ProjectDetails>(
    key: TKey,
    value: ProjectDetails[TKey],
  ) {
    setFields((current) => ({
      ...current,
      details: { ...current.details, [key]: value },
    }))
    setError('')
  }

  function setExtraFields(
    change: (current: Array<ExtraField>) => Array<ExtraField>,
  ) {
    setFields((current) => ({
      ...current,
      extraFields: change(current.extraFields),
    }))
  }

  function addExtraField(label = '') {
    setExtraFields((current) => [...current, { label, value: '' }])
  }

  function updateExtraField(index: number, change: Partial<ExtraField>) {
    setExtraFields((current) =>
      current.map((field, each) =>
        each === index ? { ...field, ...change } : field,
      ),
    )
  }

  // Puts back the last saved values.
  function discard() {
    const reset = fieldsFrom(initial)
    setFields(reset)
    onNameChange?.(reset.name)
    setSaved(snapshotOf(reset))
    setError('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give the project a name.')
      return
    }
    if (cityInput.trim() && !selectedCity) {
      setError('Choose the project’s city from the list.')
      return
    }
    const costText = cost.replace(/[$,\s]/g, '')
    const estimatedCost = costText ? Number(costText) : null
    if (
      estimatedCost !== null &&
      (!Number.isInteger(estimatedCost) ||
        estimatedCost < 0 ||
        estimatedCost > MAX_ESTIMATED_COST)
    ) {
      setError('Enter the estimated cost in whole dollars.')
      return
    }

    setError('')
    setIsSaving(true)
    isSubmittingRef.current = true
    try {
      await onSubmit({
        name,
        city: selectedCity
          ? { name: selectedCity.name, region: selectedCity.region ?? '' }
          : null,
        details: { ...details, estimatedCost },
        extraFields,
      })
      setSaved(snapshotOf(fields))
    } catch (submitError) {
      setError(
        errorMessage(submitError, 'The project couldn’t be saved. Try again.'),
      )
    } finally {
      isSubmittingRef.current = false
      setIsSaving(false)
    }
  }

  const usedLabels = new Set(
    extraFields.map((field) => field.label.trim().toLowerCase()),
  )
  const suggestions = SUGGESTED_EXTRA_FIELDS.filter(
    (label) => !usedLabels.has(label.toLowerCase()),
  )

  // Shown greyed in the applicant column when the owner is filing.
  const applicantIsOwner = details.applicantIsOwner

  return (
    <form id={formId} noValidate onSubmit={submit}>
      <CanCopyContext value={variant === 'edit'}>
        <Table
          title="Property and work"
          description="Where the work happens and what it is."
        >
          {variant === 'create' && (
            <Row label="Project name">
              {(id) => (
                <input
                  id={id}
                  className={cellClass}
                  maxLength={MAX_PROJECT_NAME_LENGTH}
                  placeholder="e.g. Backyard fence"
                  value={name}
                  onChange={(event) => update({ name: event.target.value })}
                />
              )}
            </Row>
          )}
          <tr className={rowClass}>
            <th scope="row" className={labelCellClass}>
              City
            </th>
            <td className="p-0">
              <Copyable
                label="City"
                value={selectedCity ? formatCity(selectedCity) : ''}
              >
                <CityCombobox
                  compactInputClass={
                    variant === 'edit' ? `${cellClass} pr-10` : cellClass
                  }
                  selectedCity={selectedCity}
                  value={cityInput}
                  onChange={(value) =>
                    update({ cityInput: value, selectedCity: undefined })
                  }
                  onCitySelected={(city) =>
                    update({ cityInput: formatCity(city), selectedCity: city })
                  }
                />
              </Copyable>
            </td>
          </tr>
          {PROPERTY_KEYS.map((key) => (
            <DetailRow
              key={key}
              field={fieldFor(key)}
              value={details[key]}
              onChange={(value) => setDetail(key, value)}
            />
          ))}
          <Row label="Estimated cost">
            {(id) => (
              <Copyable label="Estimated cost" value={cost}>
                <div className="flex items-center">
                  <span aria-hidden="true" className="pl-3 text-ink/60">
                    $
                  </span>
                  <input
                    id={id}
                    className={`${cellClass} pl-1`}
                    inputMode="numeric"
                    placeholder="Labor and materials"
                    value={cost}
                    onChange={(event) => update({ cost: event.target.value })}
                  />
                </div>
              </Copyable>
            )}
          </Row>
          <DetailRow
            field={fieldFor('workDescription')}
            value={details.workDescription}
            onChange={(value) => setDetail('workDescription', value)}
          />
        </Table>

        <section className="mt-8">
          <TableHeading
            title="People"
            description="Who owns the property, who’s filing, and who’s doing the work."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse border-y border-ink text-sm">
              <thead>
                <tr className={rowClass}>
                  <td className={labelCellClass} />
                  <th scope="col" className={columnHeadClass}>
                    Owner
                  </th>
                  <th scope="col" className={columnHeadClass}>
                    <span className="flex items-center justify-between gap-2">
                      Applicant
                      <label className="flex items-center gap-1.5 font-normal text-ink/70">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-blueprint"
                          checked={applicantIsOwner}
                          onChange={(event) =>
                            setDetail('applicantIsOwner', event.target.checked)
                          }
                        />
                        Same as owner
                      </label>
                    </span>
                  </th>
                  <th scope="col" className={columnHeadClass}>
                    Contractor
                  </th>
                </tr>
              </thead>
              <tbody>
                {PEOPLE_ROWS.map((row) => (
                  <tr key={row.label} className={rowClass}>
                    <th scope="row" className={labelCellClass}>
                      {row.label}
                    </th>
                    {PARTIES.map((party) => {
                      const key = row[party]
                      if (!key) {
                        return (
                          <td
                            key={party}
                            className="border-l border-ink/20 bg-ink/[0.03]"
                          />
                        )
                      }
                      // The owner's values stand in for the applicant's.
                      const shownKey =
                        party === 'applicant' && applicantIsOwner
                          ? row.owner
                          : key
                      const field = fieldFor(key)
                      return (
                        <td key={party} className="border-l border-ink/20 p-0">
                          <Copyable
                            label={`${PARTY_LABELS[party]} ${field.label.toLowerCase()}`}
                            value={shownKey ? details[shownKey] : ''}
                          >
                            <input
                              aria-label={`${PARTY_LABELS[party]} ${field.label.toLowerCase()}`}
                              className={cellClass}
                              disabled={
                                party === 'applicant' && applicantIsOwner
                              }
                              type={field.type ?? 'text'}
                              maxLength={field.maxLength}
                              placeholder={
                                party === 'contractor' && row.label === 'Name'
                                  ? 'Company'
                                  : field.placeholder
                              }
                              value={shownKey ? details[shownKey] : ''}
                              onChange={(event) =>
                                setDetail(key, event.target.value)
                              }
                            />
                          </Copyable>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <TableHeading
            title="Other details"
            description="Anything else your city’s forms ask for."
          />
          <table className="w-full border-collapse border-y border-ink text-sm">
            <tbody>
              {extraFields.map((field, index) => (
                <tr key={index} className={`${rowClass} group/extra`}>
                  <td className={`${labelCellClass} p-0`}>
                    <input
                      aria-label="Field name"
                      className={`${cellClass} text-ink/70`}
                      maxLength={MAX_EXTRA_LABEL_LENGTH}
                      placeholder="Label"
                      value={field.label}
                      onChange={(event) =>
                        updateExtraField(index, { label: event.target.value })
                      }
                    />
                  </td>
                  <td className="p-0">
                    <Copyable
                      label={field.label || 'Value'}
                      value={field.value}
                    >
                      <input
                        aria-label={
                          field.label ? `${field.label} value` : 'Value'
                        }
                        autoFocus={field.label !== '' && field.value === ''}
                        className={cellClass}
                        maxLength={MAX_EXTRA_VALUE_LENGTH}
                        placeholder="Value"
                        value={field.value}
                        onChange={(event) =>
                          updateExtraField(index, { value: event.target.value })
                        }
                      />
                    </Copyable>
                  </td>
                  <td className="w-9 p-0 text-center">
                    <button
                      type="button"
                      aria-label={`Remove ${field.label || 'field'}`}
                      className="size-8 rounded-full text-ink/40 transition hover:bg-redline/10 hover:text-redline focus-visible:text-redline"
                      onClick={() =>
                        setExtraFields((current) =>
                          current.filter((_, each) => each !== index),
                        )
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {extraFields.length < MAX_EXTRA_FIELDS && (
                <tr>
                  <td colSpan={3} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        className={chipClass}
                        onClick={() => addExtraField()}
                      >
                        + Add a field
                      </button>
                      {suggestions.map((label) => (
                        <button
                          key={label}
                          type="button"
                          className={`${chipClass} border-dashed text-ink/70`}
                          onClick={() => addExtraField(label)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </CanCopyContext>

      {variant === 'create' ? (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-ink pt-5">
          <button
            type="submit"
            disabled={isSaving}
            className={primaryButtonClass}
          >
            <Pending isPending={isSaving} label={pendingLabel} onFill>
              {submitLabel}
            </Pending>
          </button>
          {onCancel && (
            <button
              type="button"
              className={textButtonClass}
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          {error && (
            <Notice tone="error" className="mt-3 w-full">
              {error}
            </Notice>
          )}
        </div>
      ) : (
        (isDirty || isSaving || error) && (
          // Pinned to the bottom of the window while there are changes.
          <div className="sticky bottom-0 z-30 mt-8 -mx-4 border-t border-ink bg-paper px-4 py-3 sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="mr-auto text-sm font-medium text-ink" role="status">
                {isSaving
                  ? 'Saving your changes…'
                  : 'You have unsaved changes.'}
              </p>
              <button
                type="button"
                disabled={isSaving}
                className={textButtonClass}
                onClick={discard}
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={primaryButtonClass}
              >
                <Pending isPending={isSaving} label={pendingLabel} onFill>
                  {submitLabel}
                </Pending>
              </button>
            </div>
            {error && (
              <Notice tone="error" className="mt-3 w-full">
                {error}
              </Notice>
            )}
          </div>
        )
      )}
    </form>
  )
}

// Spreadsheet cells: borderless inputs that fill the cell and tint on focus,
// so Tab moves down the table like a form.
const cellClass =
  'block w-full min-w-0 bg-transparent px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 hover:bg-ink/[0.03] focus:bg-blueprint/[0.06] focus:ring-1 focus:ring-blueprint focus:ring-inset disabled:text-ink/45 disabled:hover:bg-transparent'
const rowClass = 'border-b border-ink/20 last:border-b-0'
const labelCellClass =
  'w-32 border-r border-ink/20 px-3 py-2 text-left align-top font-normal text-ink/60 sm:w-44'
const columnHeadClass =
  'border-l border-ink/20 px-3 py-2 text-left text-xs font-medium text-ink'

const PROPERTY_KEYS = [
  'streetAddress',
  'unit',
  'zipCode',
  'parcelNumber',
] as const

type Party = 'owner' | 'applicant' | 'contractor'
const PARTIES: Array<Party> = ['owner', 'applicant', 'contractor']
const PARTY_LABELS: Record<Party, string> = {
  owner: 'Owner',
  applicant: 'Applicant',
  contractor: 'Contractor',
}

// The people table: one row per question, one column per party. A missing
// key is a question that party isn't asked.
const PEOPLE_ROWS: Array<
  { label: string } & Partial<Record<Party, ProjectTextKey>>
> = [
  {
    label: 'Name',
    owner: 'ownerName',
    applicant: 'applicantName',
    contractor: 'contractorCompany',
  },
  {
    label: 'Phone',
    owner: 'ownerPhone',
    applicant: 'applicantPhone',
    contractor: 'contractorPhone',
  },
  {
    label: 'Email',
    owner: 'ownerEmail',
    applicant: 'applicantEmail',
    contractor: 'contractorEmail',
  },
  { label: 'Mailing address', owner: 'ownerMailingAddress' },
  { label: 'License number', contractor: 'contractorLicense' },
]

function fieldFor(key: ProjectTextKey) {
  const field = PROJECT_TEXT_FIELDS.find((each) => each.key === key)
  if (!field) throw new Error(`Unknown project field: ${key}`)
  return field
}

function TableHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
      <h3 className="text-xs font-medium tracking-[0.16em] text-blueprint uppercase">
        {title}
      </h3>
      <p className="text-sm text-ink/60">{description}</p>
    </div>
  )
}

function Table({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="mt-6">
      <TableHeading title={title} description={description} />
      <table className="w-full border-collapse border-y border-ink text-sm">
        <tbody>{children}</tbody>
      </table>
    </section>
  )
}

// A label and one input, linked by ID.
function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <tr className={rowClass}>
      <th scope="row" className={labelCellClass} title={hint}>
        <label htmlFor={id}>{label}</label>
      </th>
      <td className="p-0">{children(id)}</td>
    </tr>
  )
}

function DetailRow({
  field,
  value,
  onChange,
}: {
  field: (typeof PROJECT_TEXT_FIELDS)[number]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Row label={field.label} hint={field.hint}>
      {(id) => (
        <Copyable label={field.label} value={value}>
          {field.multiline ? (
            <textarea
              id={id}
              rows={2}
              className={`${cellClass} resize-y [field-sizing:content]`}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <input
              id={id}
              className={cellClass}
              type={field.type ?? 'text'}
              autoComplete={field.autoComplete ?? 'off'}
              maxLength={field.maxLength}
              placeholder={
                field.hint ? fieldHintPlaceholder(field.key) : field.placeholder
              }
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </Copyable>
      )}
    </Row>
  )
}

// Short hints fit in the empty cell.
function fieldHintPlaceholder(key: ProjectTextKey) {
  return key === 'parcelNumber' ? 'PIN, APN or tax ID' : undefined
}

// Whether cells show a copy button: on a saved project's page, where its
// values are copied into forms the editor couldn't fill.
const CanCopyContext = createContext(false)

// A cell's input with a button that copies its value, shown on hover or
// focus, or always on touch screens.
function Copyable({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) {
  const canCopy = useContext(CanCopyContext)
  if (!canCopy) return children

  return (
    <div className="group/copy relative [&_input]:pr-10 [&_textarea]:pr-10">
      {children}
      {value.trim() && (
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          title="Copy"
          className="absolute top-1 right-1 grid size-7 place-items-center rounded-full text-ink/45 opacity-0 transition group-focus-within/copy:opacity-100 group-hover/copy:opacity-100 hover:bg-ink/10 hover:text-ink focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={() => void copyWithToast(label, value)}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
        </button>
      )}
    </div>
  )
}
