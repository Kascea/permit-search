import { STATE_NAMES } from '#/lib/location/states'
import { boxValue, codeMatches, fillOptions } from '#/lib/projects/autofill'
import type { FillField } from '#/lib/projects/autofill'

import { z } from 'zod'

import { errorBodySchema, findFields, getProjects } from './api'
import { tabOriginKey, webFillSchema } from './messages'
import type {
  ContentRequest,
  FillResponse,
  FillResult,
  ReadResponse,
  WebField,
  WebFill,
  WorkerRequest,
  WorkerResponse,
} from './messages'

// The service worker: runs autofill's process on the portal tab's form, the
// same way the editor runs it on a PDF. Code fills what it can place
// (codeMatches), then Jev looks for the rest through the site's find-fields
// route, which shares the editor's code. Fields are read from the page's HTML;
// no screenshots are sent. See docs: Browser extension plan.

// boxValue takes PDF points; a CSS pixel is three quarters of one.
const POINTS_PER_PIXEL = 0.75

const STATE_ABBREVIATIONS = new Map(
  Object.entries(STATE_NAMES).map(([abbreviation, name]) => [name, abbreviation]),
)

const STATES_BY_ABBREVIATION = new Map<string, string>(Object.entries(STATE_NAMES))

// The fills made in each tab, kept for Undo.
const storedFillsSchema = z.array(webFillSchema).catch([])

// The icon's click is handled here rather than by the side panel's own
// openPanelOnActionClick: a plain action click is what grants activeTab, which
// lets the worker read the page's address. The panel reads the origin from
// session storage to ask for that portal's permission.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

chrome.action.onClicked.addListener((tab) => {
  // First, while the click still counts as a user gesture.
  void chrome.sidePanel.open({ windowId: tab.windowId })

  if (tab.id !== undefined && tab.url) {
    void chrome.storage.session.set({ [tabOriginKey(tab.id)]: new URL(tab.url).origin })
  }
})

async function sendToTab<T>(tabId: number, message: ContentRequest): Promise<T> {
  const response: unknown = await chrome.tabs.sendMessage(tabId, message)
  const error = errorBodySchema.safeParse(response)

  if (error.success) throw new Error(error.data.error)

  // SAFETY: content.ts answers each request with its matching response.
  return response as T
}

// A field's width as boxValue reads it. A field that takes 2 or 3 characters
// is narrow, whatever its width on screen.
function widthOf(field: WebField) {
  return field.maxLength > 0 && field.maxLength <= 3
    ? 0
    : field.width * POINTS_PER_PIXEL
}

// Other ways a dropdown may write a value: "MN" for "Minnesota" and back.
function alternativesOf(value: string) {
  const abbreviation = STATE_ABBREVIATIONS.get(value)

  if (abbreviation) return [abbreviation]

  const name = STATES_BY_ABBREVIATION.get(value)

  return name ? [name] : []
}

// Only what find-fields takes: never the field's width or emptiness.
function fieldInput({ id, name, label, section, nearby, kind }: WebField) {
  return { id, name, label, section, nearby, kind }
}

async function fillTab(tabId: number, projectId: string): Promise<FillResult | null> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })

  // Step 1: read the form's fields from the page's HTML.
  const { title, fields } = await sendToTab<ReadResponse>(tabId, { type: 'read' })

  // Step 2: nothing to fill.
  if (fields.length === 0) return null

  const project = (await getProjects()).find((candidate) => candidate.publicId === projectId)

  if (!project) throw new Error('That project couldn’t be found.')

  // Steps 3 and 4: the project's values, and the matches code can make.
  const fillFields: Array<FillField> = fields.map((field) => ({
    id: field.id,
    name: field.name,
    label: field.label || field.nearby,
    width: widthOf(field),
    isEmpty: field.isEmpty,
  }))

  const code = codeMatches(fillFields, project)

  const codeFills: Array<WebFill> = [...code.fills].map(([fieldId, { value, label }]) => ({
    fieldId,
    label,
    value,
    alternatives: alternativesOf(value),
  }))

  const filled = [
    ...(await sendToTab<FillResponse>(tabId, { type: 'fill', fills: codeFills })).filled,
  ]

  const options = new Map(fillOptions(project).map((option) => [option.id, option]))
  const remaining = [...options.values()].filter(({ id }) => !code.placedOptionIds.has(id))
  const boxes = fields.filter((field) => field.isEmpty && !code.fills.has(field.id))

  console.info('[autofill] code matched', {
    filled: filled.length,
    leftForJev: remaining.map(({ label }) => label),
    emptyFields: boxes.length,
  })

  // Steps 5 to 8: Jev finds a field for each value left, and code fills the
  // ones it's sure of.
  const foundOptionIds = new Set<string>()
  let jevFailed = false

  if (remaining.length > 0 && boxes.length > 0) {
    try {
      const fieldsById = new Map(boxes.map((box) => [box.id, box]))

      const matches = await findFields({
        projectId,
        title,
        fields: boxes.map(fieldInput),
        optionIds: remaining.map(({ id }) => id),
      })

      const jevFills = matches.flatMap(({ boxName, optionId }) => {
        const box = fieldsById.get(boxName)
        const option = options.get(optionId)

        if (!box || !option) return []

        foundOptionIds.add(optionId)

        const value = boxValue(option, widthOf(box))

        return [{ fieldId: box.id, label: option.label, value, alternatives: alternativesOf(value) }]
      })

      console.info('[autofill] jev matched', { matches })

      filled.push(
        ...(await sendToTab<FillResponse>(tabId, { type: 'fill', fills: jevFills })).filled,
      )
    } catch (error) {
      console.error('[autofill] find-fields failed', error)
      jevFailed = true
    }
  }

  await chrome.storage.session.set({ [`fills:${tabId}`]: filled })

  return {
    filled: filled.map(({ label, value }) => ({ label, value })),
    notFound: remaining.flatMap(({ id, label }) => (foundOptionIds.has(id) ? [] : [label])),
    jevFailed,
  }
}

async function undoTab(tabId: number) {
  const key = `fills:${tabId}`
  const fills = storedFillsSchema.parse((await chrome.storage.session.get(key))[key])

  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  await sendToTab(tabId, { type: 'undo', fills })
  await chrome.storage.session.remove(key)

  return null
}

function run(message: WorkerRequest) {
  switch (message.type) {
    case 'fill':
      return fillTab(message.tabId, message.projectId)
    case 'undo':
      return undoTab(message.tabId)
  }
}

async function respondTo(message: WorkerRequest): Promise<WorkerResponse> {
  try {
    return { ok: true, result: await run(message) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Fill didn’t work.' }
  }
}

chrome.runtime.onMessage.addListener(
  (message: WorkerRequest, sender, respond: (response: WorkerResponse) => void) => {
    // Only the side panel asks; content scripts only answer.
    if (sender.id !== chrome.runtime.id || sender.tab) return false

    void respondTo(message).then(respond)

    return true
  },
)

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove([`fills:${tabId}`, tabOriginKey(tabId)])
})
