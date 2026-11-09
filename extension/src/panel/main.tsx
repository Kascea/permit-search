import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { z } from 'zod'

import type { Project } from '#/lib/projects/types'

import { SITE_URL, SignedOutError, getProjects, getSession } from '../api'
import type { ExtensionUser } from '../api'
import { tabOriginKey } from '../messages'
import type { FillResult, WorkerRequest, WorkerResponse } from '../messages'
import './panel.css'

type Account =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'signed-in'; user: ExtensionUser; projects: Array<Project> }

type Fill =
  | { status: 'idle' }
  | { status: 'filling' }
  | { status: 'done'; result: FillResult | null }
  | { status: 'error'; message: string }

interface CurrentTab {
  id: number
  // Known only after the user clicks the extension's icon on the page, or
  // once they've let it fill forms on the page's site.
  origin: string | null
}

const originSchema = z.string().optional().catch(undefined)

// The tab's address is visible once the user has allowed the portal's site.
// Before that, the origin the worker recorded when the icon was clicked.
async function currentTab(): Promise<CurrentTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (tab?.id === undefined) return null

  if (tab.url) return { id: tab.id, origin: new URL(tab.url).origin }

  const key = tabOriginKey(tab.id)
  const recorded = originSchema.parse((await chrome.storage.session.get(key))[key])

  return { id: tab.id, origin: recorded ?? null }
}

async function ask(message: WorkerRequest) {
  const response: WorkerResponse = await chrome.runtime.sendMessage(message)

  if (!response.ok) throw new Error(response.error)

  return response.result
}

function useAccount() {
  const [account, setAccount] = useState<Account>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const [user, projects] = await Promise.all([getSession(), getProjects()])
      setAccount({ status: 'signed-in', user, projects })
    } catch (error) {
      setAccount(
        error instanceof SignedOutError
          ? { status: 'signed-out' }
          : {
              status: 'error',
              message: error instanceof Error ? error.message : 'Something went wrong.',
            },
      )
    }
  }, [])

  // Checks again when the user comes back from signing in on the site.
  useEffect(() => {
    void refresh()

    const onTabUpdated = (_id: number, change: { status?: string }, tab: chrome.tabs.Tab) => {
      if (change.status === 'complete' && tab.url?.startsWith(SITE_URL)) void refresh()
    }

    const onFocus = () => void refresh()

    chrome.tabs.onUpdated.addListener(onTabUpdated)
    window.addEventListener('focus', onFocus)

    return () => {
      chrome.tabs.onUpdated.removeListener(onTabUpdated)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return account
}

function useCurrentTab() {
  const [tab, setTab] = useState<CurrentTab | null>(null)

  useEffect(() => {
    const refresh = () => void currentTab().then(setTab)

    refresh()
    chrome.tabs.onActivated.addListener(refresh)
    chrome.tabs.onUpdated.addListener(refresh)
    // The worker records the origin when the icon is clicked.
    chrome.storage.session.onChanged.addListener(refresh)

    return () => {
      chrome.tabs.onActivated.removeListener(refresh)
      chrome.tabs.onUpdated.removeListener(refresh)
      chrome.storage.session.onChanged.removeListener(refresh)
    }
  }, [])

  return tab
}

// The project last chosen, overall and on each portal, by origin.
const CHOSEN_PROJECTS_KEY = 'chosenProjects'

const chosenProjectsSchema = z
  .object({
    last: z.string().optional(),
    byOrigin: z.record(z.string(), z.string()),
  })
  .catch({ byOrigin: {} })

type ChosenProjects = z.infer<typeof chosenProjectsSchema>

async function readChosenProjects() {
  return chosenProjectsSchema.parse(
    (await chrome.storage.local.get(CHOSEN_PROJECTS_KEY))[CHOSEN_PROJECTS_KEY],
  )
}

// The project chosen for this portal, or else the last one chosen anywhere,
// or else the newest.
function useChosenProject(origin: string | null, projects: Array<Project>) {
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    void readChosenProjects().then((chosen) => {
      const saved = [origin ? chosen.byOrigin[origin] : undefined, chosen.last].find(
        (id) => projects.some(({ publicId }) => publicId === id),
      )

      setProjectId(saved ?? projects[0]?.publicId ?? '')
    })
  }, [origin, projects])

  const choose = async (id: string) => {
    setProjectId(id)

    const chosen: ChosenProjects = await readChosenProjects()

    chosen.last = id

    if (origin) chosen.byOrigin[origin] = id

    await chrome.storage.local.set({ [CHOSEN_PROJECTS_KEY]: chosen })
  }

  return [projectId, choose] as const
}

function Results({ result, onUndo }: { result: FillResult | null; onUndo: () => void }) {
  if (!result) {
    return <p className="muted">This page has no fields to fill.</p>
  }

  return (
    <>
      <p className={result.filled.length > 0 ? 'done' : 'muted'}>
        {result.filled.length === 1
          ? 'Filled 1 field.'
          : `Filled ${result.filled.length} fields.`}
      </p>
      {result.filled.length > 0 && (
        <ul>
          {result.filled.map(({ label, value }) => (
            <li key={`${label}:${value}`}>
              {label}
              <span className="value">{value}</span>
            </li>
          ))}
        </ul>
      )}
      {result.notFound.length > 0 && (
        <>
          <p className="muted">No field on this page for:</p>
          <ul>
            {result.notFound.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </>
      )}
      {result.jevFailed && (
        <p className="error">
          Couldn’t look for fields for the values listed above. Press Fill again to retry.
        </p>
      )}
      {result.filled.length > 0 && (
        <div className="row">
          <button type="button" className="quiet" onClick={onUndo}>
            Undo
          </button>
        </div>
      )}
      <p className="muted">Check the form, then submit it on the city’s site yourself.</p>
    </>
  )
}

// Filling the tab's page. Keyed by the page, so a new one, such as the
// portal's next step, starts afresh.
function FillPage({ tab, projectId }: { tab: CurrentTab; projectId: string }) {
  const [fill, setFill] = useState<Fill>({ status: 'idle' })

  async function fillPage() {
    if (!tab.origin?.startsWith('https://')) {
      setFill({
        status: 'error',
        message:
          'Open the city’s application, then click the Permit Search icon in the toolbar so it can read the page.',
      })

      return
    }

    // Asked once per portal, so later steps can be filled without clicking the icon.
    const allowed = await chrome.permissions.request({ origins: [`${tab.origin}/*`] })

    if (!allowed) {
      setFill({ status: 'error', message: 'Permit Search needs your OK to fill this site’s forms.' })

      return
    }

    setFill({ status: 'filling' })

    try {
      setFill({ status: 'done', result: await ask({ type: 'fill', tabId: tab.id, projectId }) })
    } catch (error) {
      setFill({
        status: 'error',
        message: error instanceof Error ? error.message : 'Fill didn’t work.',
      })
    }
  }

  async function undo() {
    try {
      await ask({ type: 'undo', tabId: tab.id })
      setFill({ status: 'idle' })
    } catch (error) {
      setFill({
        status: 'error',
        message: error instanceof Error ? error.message : 'Undo didn’t work.',
      })
    }
  }

  return (
    <>
      <div className="row">
        <button
          type="button"
          disabled={!projectId || fill.status === 'filling'}
          onClick={() => void fillPage()}
        >
          {fill.status === 'filling' ? 'Filling…' : 'Fill this page'}
        </button>
      </div>
      {(fill.status === 'done' || fill.status === 'error') && (
        <section aria-live="polite">
          {fill.status === 'done' ? (
            <Results result={fill.result} onUndo={() => void undo()} />
          ) : (
            <p className="error">{fill.message}</p>
          )}
        </section>
      )}
    </>
  )
}

function SignedIn({
  user,
  projects,
}: {
  user: ExtensionUser
  projects: Array<Project>
}) {
  const tab = useCurrentTab()
  const [projectId, chooseProject] = useChosenProject(tab?.origin ?? null, projects)

  if (projects.length === 0) {
    return (
      <section>
        <p>You don’t have any projects yet.</p>
        <button type="button" onClick={() => void chrome.tabs.create({ url: `${SITE_URL}/projects/new` })}>
          Create a project
        </button>
      </section>
    )
  }

  return (
    <>
      <section>
        <label htmlFor="project">Fill from project</label>
        <select
          id="project"
          value={projectId}
          onChange={(event) => void chooseProject(event.target.value)}
        >
          {projects.map((project) => (
            <option key={project.publicId} value={project.publicId}>
              {project.city ? `${project.name} · ${project.city.name}` : project.name}
            </option>
          ))}
        </select>
        {tab && <FillPage key={`${tab.id}:${tab.origin}`} tab={tab} projectId={projectId} />}
      </section>
      <section>
        <p className="muted">
          Signed in as {user.name || user.email}.{' '}
          <button
            type="button"
            className="link"
            onClick={() => void chrome.tabs.create({ url: `${SITE_URL}/settings` })}
          >
            Account
          </button>
        </p>
      </section>
    </>
  )
}

function Panel() {
  const account = useAccount()

  return (
    <main>
      <p className="eyebrow">Permit Search</p>
      <h1>Fill an online application</h1>
      <p className="muted">
        Fills the city’s form from your project. You review it and click Submit.
      </p>
      {account.status === 'loading' && <p className="muted">Checking your account…</p>}
      {account.status === 'error' && <p className="error">{account.message}</p>}
      {account.status === 'signed-out' && (
        <section>
          <p>Sign in to fill forms from your projects.</p>
          <button
            type="button"
            onClick={() => void chrome.tabs.create({ url: `${SITE_URL}/projects` })}
          >
            Sign in to Permit Search
          </button>
        </section>
      )}
      {account.status === 'signed-in' && (
        <SignedIn user={account.user} projects={account.projects} />
      )}
    </main>
  )
}

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <Panel />
    </StrictMode>,
  )
}
