import type {
  ContentRequest,
  FillResponse,
  ReadResponse,
  WebField,
  WebFill,
} from './messages'

// The reader and filler, injected into the portal tab when the user presses
// Fill. It reads the form's fields from the page's HTML and sets values. It
// never clicks anything or submits.

const ID_ATTRIBUTE = 'data-permit-search-field'

const TEXT_TYPES = new Set(['', 'text', 'tel', 'email', 'number', 'search', 'url'])

// Fields no project value belongs in.
const SKIPPED_NAME = /captcha|password|card.?number|cvv|cvc|security.?code/i

// Text inside these says nothing about a field next to it.
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SELECT', 'OPTION', 'TEXTAREA'])

// Text kept for a field's nearby line and section.
const MAX_TEXT_LENGTH = 200

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

declare global {
  interface Window {
    permitSearchFillerReady?: boolean
  }
}

let nextId = 0

function clean(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

// An element's visible text, without the options of dropdowns inside it.
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''

  if (!(node instanceof HTMLElement) || SKIPPED_TAGS.has(node.tagName)) return ''

  if (node.hidden || node.getAttribute('aria-hidden') === 'true') return ''

  return [...node.childNodes].map(textOf).join(' ')
}

function shortText(node: Node) {
  return clean(textOf(node)).slice(0, MAX_TEXT_LENGTH)
}

// Hidden by its own style or an ancestor's, or not laid out at all.
function isVisible(element: FormField) {
  return element.checkVisibility({ visibilityProperty: true })
}

// Narrows without DOM generics: the Worker types this repo also loads declare
// their own Element, which HTMLSelectElement doesn't satisfy.
function asFormField(node: Node | null): FormField | null {
  return node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement
    ? node
    : null
}

function isFillable(element: FormField) {
  if (element.disabled || !isVisible(element)) return false

  if (SKIPPED_NAME.test(`${element.name} ${element.id}`)) return false

  if (element instanceof HTMLSelectElement) return !element.multiple

  if (element.readOnly) return false

  return element instanceof HTMLTextAreaElement || TEXT_TYPES.has(element.type)
}

// The field's own label: a <label>, aria-labelledby, aria-label, a title,
// or else its placeholder.
function labelOf(element: FormField) {
  const labels = [...(element.labels ?? [])].flatMap((labelElement) => {
    const text = shortText(labelElement)

    return text ? [text] : []
  })

  if (labels.length > 0) return labels.join(' ')

  const labelledBy = element.getAttribute('aria-labelledby')

  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .map((labelElement) => (labelElement ? shortText(labelElement) : ''))
      .join(' ')

    if (clean(text)) return clean(text)
  }

  return clean(
    element.getAttribute('aria-label') ||
      element.title ||
      ('placeholder' in element ? element.placeholder : ''),
  )
}

// The text of the field's row or cell, standing in for the line a PDF field
// is printed on. Climbs until the text says more than the label, stopping
// before an ancestor that holds several fields.
function nearbyOf(element: FormField, label: string) {
  let line = ''

  for (
    let ancestor = element.parentElement;
    ancestor && ancestor !== document.body;
    ancestor = ancestor.parentElement
  ) {
    if (ancestor.querySelectorAll('input, select, textarea').length > 3) break

    line = shortText(ancestor)

    if (line.length > label.length + 2) break
  }

  return line
}

// The nearest legend or heading above the field.
function sectionOf(element: FormField) {
  const legend = element.closest('fieldset')?.querySelector('legend')

  if (legend) return shortText(legend)

  const headings = [
    ...document.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, [role="heading"]'),
  ].filter(
    (heading) =>
      heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
  )

  const heading = headings.at(-1)

  return heading ? shortText(heading) : ''
}

// A dropdown is empty while it shows its placeholder, such as "Select one".
function isEmptyField(element: FormField) {
  if (!(element instanceof HTMLSelectElement)) return element.value.trim() === ''

  const selected = element.selectedOptions[0]

  return (
    !selected ||
    selected.value === '' ||
    (element.selectedIndex === 0 && /select|choose|^\W*$/i.test(selected.text))
  )
}

function fieldId(element: FormField) {
  const existing = element.getAttribute(ID_ATTRIBUTE)

  if (existing) return existing

  nextId += 1
  const id = `field_${nextId}`
  element.setAttribute(ID_ATTRIBUTE, id)

  return id
}

function readFields(): ReadResponse {
  const elements = [...document.querySelectorAll('input, textarea, select')].flatMap(
    (node) => {
      const element = asFormField(node)

      return element && isFillable(element) ? [element] : []
    },
  )

  const fields = elements.map((element): WebField => {
    const label = labelOf(element)

    return {
      id: fieldId(element),
      name: element.name || element.id,
      label,
      nearby: nearbyOf(element, label),
      section: sectionOf(element),
      kind: element instanceof HTMLSelectElement ? 'select' : 'text',
      width: element.getBoundingClientRect().width,
      maxLength:
        element instanceof HTMLSelectElement ? 0 : Math.max(element.maxLength, 0),
      isEmpty: isEmptyField(element),
    }
  })

  return { title: document.title, fields }
}

function elementFor(id: string) {
  return asFormField(document.querySelector(`[${ID_ATTRIBUTE}="${CSS.escape(id)}"]`))
}

function normalized(text: string) {
  return text.trim().toLowerCase()
}

// Sets a value the way typing would, so the page's own scripts (React,
// Angular, ASP.NET validators) see it.
function setValue(element: FormField, value: string) {
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype

  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

// The value a field takes for a fill, or null when it can't take it: a
// dropdown with no matching option, or a value longer than the field allows.
function valueFor(element: FormField, fill: WebFill) {
  if (element instanceof HTMLSelectElement) {
    const wanted = new Set([fill.value, ...fill.alternatives].map(normalized))

    const option = [...element.options].find(
      (candidate) =>
        wanted.has(normalized(candidate.text)) ||
        wanted.has(normalized(candidate.value)),
    )

    return option ? option.value : null
  }

  if (element.maxLength > 0 && fill.value.length > element.maxLength) return null

  return fill.value
}

function fillFields(fills: Array<WebFill>): FillResponse {
  const filled = fills.filter((candidate) => {
    const element = elementFor(candidate.fieldId)

    if (!element || !isEmptyField(element)) return false

    const value = valueFor(element, candidate)

    if (value === null) return false

    setValue(element, value)

    return true
  })

  return { filled }
}

// Clears only the fields still holding what was filled, so later typing is kept.
function undo(fills: Array<WebFill>) {
  for (const candidate of fills) {
    const element = elementFor(candidate.fieldId)

    if (!element) continue

    if (element instanceof HTMLSelectElement) {
      if (valueFor(element, candidate) === element.value) {
        element.selectedIndex = 0
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }
    } else if (element.value === candidate.value) {
      setValue(element, '')
    }
  }

  return { filled: [] }
}

async function handle(message: ContentRequest) {
  switch (message.type) {
    case 'read':
      return readFields()
    case 'fill':
      return fillFields(message.fills)
    case 'undo':
      return undo(message.fills)
  }
}

async function respondTo(message: ContentRequest) {
  try {
    return await handle(message)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The page couldn’t be read.' }
  }
}

// Injected again on every Fill; listens only once.
if (!window.permitSearchFillerReady) {
  window.permitSearchFillerReady = true

  chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, respond) => {
    void respondTo(message).then(respond)

    return true
  })
}
