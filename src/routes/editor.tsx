import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  PDFBool,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
} from 'pdf-lib'
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist'

import { UserError, errorMessage } from '#/lib/errors'
import { AccountMenu } from '#/components/AccountMenu'
import { Breadcrumbs, OriginCrumb } from '#/components/Breadcrumbs'
import { DraftSidebar } from '#/components/DraftSidebar'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { ProjectFillMenu } from '#/components/ProjectFillMenu'
import { SignInButton } from '#/components/SignInDialog'
import { useAuth } from '#/lib/auth/use-auth'
import { deleteAccountDraft } from '#/lib/drafts/drafts'
import { deleteLocalDraft } from '#/lib/drafts/local'
import { draftTitle } from '#/lib/drafts/types'
import type {
  DraftContent,
  EditorTool,
  NativeValue,
  PdfRect,
  PlacedField,
} from '#/lib/drafts/types'
import {
  loadNewestDraft,
  useDraftAutosave,
} from '#/lib/drafts/use-draft-autosave'
import type { DraftStatus } from '#/lib/drafts/use-draft-autosave'
import { projectFills } from '#/lib/projects/autofill'
import type { Project } from '#/lib/projects/types'
import { useAccountProjects } from '#/lib/projects/use-account-projects'
import { parseOrigin, searchLabel } from '#/lib/navigation/origin'
import type { Origin } from '#/lib/navigation/origin'
import { getSearchSummary } from '#/lib/search/permit-search'

type NativeField =
  | {
      id: string
      kind: 'text'
      name: string
      value: string
      multiline: boolean
      widgets: Array<PdfRect>
    }
  | {
      id: string
      kind: 'checkbox'
      name: string
      checked: boolean
      widgets: Array<PdfRect>
    }
  | {
      id: string
      kind: 'choice'
      name: string
      value: string
      options: Array<string>
      widgets: Array<PdfRect>
    }
  | {
      id: string
      kind: 'multiple'
      name: string
      values: Array<string>
      options: Array<string>
      widgets: Array<PdfRect>
    }

export const Route = createFileRoute('/editor')({
  // project: the project to fill from. from: the page it was opened from, for
  // the breadcrumb; see Origin.
  validateSearch: (
    search: Record<string, unknown>,
  ): { url: string; project?: string; from?: string } => ({
    url: typeof search.url === 'string' ? search.url : '',
    ...(typeof search.project === 'string' ? { project: search.project } : {}),
    ...(typeof search.from === 'string' ? { from: search.from } : {}),
  }),
  loaderDeps: ({ search }) => ({ from: search.from }),
  // The search the editor was opened from, to name it in the breadcrumb. A
  // failed lookup just leaves the breadcrumb generic.
  loader: async ({ deps }) => {
    const origin = parseOrigin(deps.from)
    if (origin?.kind !== 'search') return { searchName: undefined }
    const summary = await getSearchSummary({
      data: { publicId: origin.id },
    }).catch(() => null)
    return { searchName: summary ? searchLabel(summary) : undefined }
  },
  component: EditorRoute,
})

// Keyed by URL so opening another draft starts with fresh state, and the
// closing editor saves any pending edit.
function EditorRoute() {
  const { url, project, from } = Route.useSearch()
  const { searchName } = Route.useLoaderData()
  // Links from before ?from= name only the project.
  const origin: Origin = parseOrigin(from) ??
    (project ? { kind: 'project', id: project } : { kind: 'drafts' })
  const projectId =
    project ?? (origin.kind === 'project' ? origin.id : undefined)
  return (
    <PdfEditor
      key={url}
      url={url}
      projectId={projectId}
      origin={origin}
      searchName={searchName}
    />
  )
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5]

function PdfEditor({
  url,
  projectId,
  origin,
  searchName,
}: {
  url: string
  projectId?: string
  origin: Origin
  searchName?: string
}) {
  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer>()
  const [pdf, setPdf] = useState<PDFDocumentProxy>()
  const [nativeFields, setNativeFields] = useState<Array<NativeField>>([])
  const [placedFields, setPlacedFields] = useState<Array<PlacedField>>([])
  const [activeTool, setActiveTool] = useState<EditorTool>()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(url))
  const [isSaving, setIsSaving] = useState(false)
  const { user } = useAuth()
  const signedIn = Boolean(user)
  // SHA-256 of the PDF; set once it loads, which starts autosaving.
  const [sourceHash, setSourceHash] = useState<string>()
  // Shown when the restored draft was made on an older copy of the PDF.
  const [draftNotice, setDraftNotice] = useState('')
  // PDF.js render scale; 1 is the PDF's size at 72 DPI.
  const [scale, setScale] = useState(1.25)
  const [currentPage, setCurrentPage] = useState(1)
  // The drafts drawer on small screens; the sidebar is always shown on large.
  const [isDraftsOpen, setIsDraftsOpen] = useState(false)
  const { projects } = useAccountProjects(signedIn)
  // The project chosen in the fill menu, or the one the editor was opened from.
  const [fillProjectId, setFillProjectId] = useState(projectId)
  const scrollRef = useRef<HTMLElement>(null)
  // Page 1's width at scale 1, for fitting the page to the window.
  const pageWidthRef = useRef(612)

  const fieldCounts = useMemo(
    () => ({
      total: nativeFields.length,
      filled: nativeFields.filter(isFilled).length,
    }),
    [nativeFields],
  )

  // The project to fill from: the chosen one, else the first holding this PDF,
  // else the most recent.
  const fillProject =
    projects?.find((project) => project.publicId === fillProjectId) ??
    projects?.find((project) =>
      project.items.some((item) => item.sourceUrl === url),
    ) ??
    projects?.at(0)
  // The text fields still empty, which a project can fill.
  const emptyTextFields = useMemo(
    () =>
      nativeFields.flatMap((field) =>
        field.kind === 'text' && !field.value.trim()
          ? [{ id: field.id, name: field.name, width: field.widgets[0].width }]
          : [],
      ),
    [nativeFields],
  )
  // How many empty fields each project can fill, by public ID.
  const fillCounts = useMemo(
    () =>
      new Map(
        (projects ?? []).map((project) => [
          project.publicId,
          projectFills(emptyTextFields, project).size,
        ]),
      ),
    [projects, emptyTextFields],
  )

  const draftContent = useMemo<DraftContent>(
    () => ({
      version: 1,
      nativeValues: nativeValuesOf(nativeFields),
      placedFields,
    }),
    [nativeFields, placedFields],
  )
  const {
    status: draftStatus,
    setStatus: setDraftStatus,
    resetBaseline,
  } = useDraftAutosave({
    sourceUrl: url,
    sourceHash,
    content: draftContent,
    signedIn,
    searchId: origin.kind === 'search' ? origin.id : undefined,
  })

  useEffect(() => {
    let cancelled = false
    let loadedPdf: PDFDocumentProxy | undefined

    async function load() {
      // No form chosen: the editor shows drafts and a way to find one.
      if (!url) {
        setIsLoading(false)
        return
      }

      try {
        // The PDF, pdf.js, and the saved draft download side by side. The
        // draft is restored before the fields first render, so typing can't
        // race it. It's read once per PDF: signing out mid-edit keeps the
        // fields on screen and later saves go to this browser.
        const [
          bytes,
          [{ getDocument, GlobalWorkerOptions }, workerModule],
          saved,
        ] = await Promise.all([
          fetchPdfBytes(url),
          Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
          ]),
          loadNewestDraft(url, signedIn),
        ])
        GlobalWorkerOptions.workerSrc = workerModule.default

        const [pdfDocument, fields, hash] = await Promise.all([
          getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise,
          readNativeFields(bytes),
          sha256Hex(bytes),
        ])
        loadedPdf = pdfDocument
        const firstPage = await pdfDocument.getPage(1)
        pageWidthRef.current = firstPage.getViewport({ scale: 1 }).width

        if (!cancelled) {
          setScale(fitWidthScale(scrollRef.current, pageWidthRef.current))
          setSourceBytes(bytes)
          setPdf(pdfDocument)
          setSourceHash(hash)
          if (saved) {
            setNativeFields(
              applyNativeValues(fields, saved.draft.content.nativeValues),
            )
            setPlacedFields(saved.draft.content.placedFields)
            setDraftStatus(saved.status)
            if (saved.draft.sourceHash !== hash) {
              setDraftNotice(
                'This form has changed since your draft was saved. Check your entries before downloading.',
              )
            }
          } else {
            setNativeFields(fields)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError, 'The PDF could not be opened.'))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (loadedPdf) void loadedPdf.cleanup()
    }
  }, [url])

  // Tracks the page nearest the top of the view for the page indicator.
  useEffect(() => {
    const container = scrollRef.current
    if (!pdf || !container) return

    const visible = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page)
          if (entry.isIntersecting) visible.set(page, entry.intersectionRatio)
          else visible.delete(page)
        }
        if (visible.size > 0) setCurrentPage(Math.min(...visible.keys()))
      },
      { root: container, rootMargin: '0px 0px -60% 0px' },
    )
    container
      .querySelectorAll('[data-page]')
      .forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [pdf])

  function scrollToPage(page: number) {
    scrollRef.current
      ?.querySelector(`[data-page="${page}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function zoom(direction: 1 | -1) {
    setScale((current) =>
      direction > 0
        ? (ZOOM_STEPS.find((step) => step > current + 0.01) ?? current)
        : ([...ZOOM_STEPS].reverse().find((step) => step < current - 0.01) ??
          current),
    )
  }

  // Scrolls to and focuses the first empty form field after the focused one,
  // in reading order, wrapping to the start.
  function focusNextEmptyField() {
    const container = scrollRef.current
    if (!container) return

    const ordered = nativeFieldsRef.current
      .filter((field) => field.widgets.length > 0)
      .sort((a, b) => {
        const [wa, wb] = [a.widgets[0], b.widgets[0]]
        return (
          wa.pageIndex - wb.pageIndex ||
          wb.y + wb.height - (wa.y + wa.height) ||
          wa.x - wb.x
        )
      })
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset
      .fieldId
    const start = ordered.findIndex((field) => field.id === focusedId) + 1
    const next = [...ordered.slice(start), ...ordered.slice(0, start)].find(
      (field) => !isFilled(field),
    )
    const element = next
      ? container.querySelector<HTMLElement>(
          `[data-field-id="${CSS.escape(next.id)}"]`,
        )
      : null
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element?.focus({ preventScroll: true })
  }

  // The shortcut handler is attached once, so it reads fields from a ref.
  const nativeFieldsRef = useRef(nativeFields)
  nativeFieldsRef.current = nativeFields
  const focusNextRef = useRef(focusNextEmptyField)
  focusNextRef.current = focusNextEmptyField

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveTool(undefined)
        return
      }
      // Leave typing in fields and browser shortcuts alone.
      const target = event.target as HTMLElement
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      const key = event.key.toLowerCase()
      const tool = TOOLS.find((item) => item.key === key)
      if (tool) {
        setActiveTool((current) =>
          current === tool.tool ? undefined : tool.tool,
        )
      } else if (key === '+' || key === '=') {
        zoom(1)
      } else if (key === '-') {
        zoom(-1)
      } else if (key === 'n') {
        focusNextRef.current()
      } else {
        return
      }
      event.preventDefault()
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function placeField(pageIndex: number, x: number, y: number) {
    if (!activeTool) return

    const dimensions =
      activeTool === 'check'
        ? { width: 18, height: 18 }
        : { width: activeTool === 'signature' ? 190 : 150, height: 24 }
    const value =
      activeTool === 'date'
        ? localDateValue()
        : activeTool === 'check'
          ? 'X'
          : ''

    setPlacedFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: activeTool,
        pageIndex,
        x,
        y: y - dimensions.height,
        ...dimensions,
        value,
      },
    ])
    setActiveTool(undefined)
  }

  function updateNativeField(
    id: string,
    update: (field: NativeField) => NativeField,
  ) {
    setNativeFields((current) =>
      current.map((field) => (field.id === id ? update(field) : field)),
    )
  }

  function updatePlacedField(id: string, value: string) {
    setPlacedFields((current) =>
      current.map((field) => (field.id === id ? { ...field, value } : field)),
    )
  }

  // Fills the empty fields the project matches. Undo clears only the fields
  // still holding the filled value, so later typing is kept.
  function fillFromProject(project: Project) {
    setFillProjectId(project.publicId)
    const filled = projectFills(emptyTextFields, project)
    if (filled.size === 0) {
      toast(`“${project.name}” has nothing to fill in the empty fields.`)
      return
    }
    const isFilledByProject = (field: NativeField) =>
      field.kind === 'text' && filled.get(field.id) === field.value
    setNativeFields((current) =>
      current.map((field) =>
        field.kind === 'text' && !field.value.trim() && filled.has(field.id)
          ? { ...field, value: filled.get(field.id) ?? '' }
          : field,
      ),
    )
    toast.success(
      `Filled ${filled.size} ${filled.size === 1 ? 'field' : 'fields'} from “${project.name}”.`,
      {
        action: {
          label: 'Undo',
          onClick: () =>
            setNativeFields((current) =>
              current.map((field) =>
                isFilledByProject(field) ? { ...field, value: '' } : field,
              ),
            ),
        },
      },
    )
  }

  // Deletes the saved draft and puts back the PDF's own values.
  async function discardDraft() {
    if (!sourceBytes) return
    if (!window.confirm('Discard your saved entries for this form?')) return

    try {
      deleteLocalDraft(url)
      const [fields] = await Promise.all([
        readNativeFields(sourceBytes),
        signedIn && deleteAccountDraft({ data: { sourceUrl: url } }),
      ])
      resetBaseline({
        version: 1,
        nativeValues: nativeValuesOf(fields),
        placedFields: [],
      })
      setNativeFields(fields)
      setPlacedFields([])
      setDraftNotice('')
      setDraftStatus('idle')
    } catch (discardError) {
      toast.error(
        errorMessage(discardError, 'The draft couldn’t be discarded.'),
      )
    }
  }

  async function downloadPdf() {
    if (!sourceBytes) return

    setIsSaving(true)
    try {
      const bytes = await createEditedPdf(
        sourceBytes,
        nativeFields,
        placedFields,
      )
      const objectUrl = URL.createObjectURL(
        new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' }),
      )
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${pdfFilename(url)}-completed.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
    } catch (saveError) {
      toast.error(
        errorMessage(saveError, 'The edited PDF couldn’t be created.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const sidebar = (
    <DraftSidebar
      currentUrl={url}
      signedIn={signedIn}
      refreshKey={draftStatus}
      onNavigate={() => setIsDraftsOpen(false)}
    />
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#e8e8e2]">
      <header className="z-50 shrink-0 border-b border-ink bg-paper">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 px-3 sm:px-4">
          <div className="flex h-12 min-w-0 flex-1 items-center gap-2">
            <Link
              aria-label="Permit Search home"
              className="shrink-0 text-ink"
              to="/"
            >
              <PermitSearchLogo className="size-7" />
            </Link>
            <button
              aria-expanded={isDraftsOpen}
              aria-label="Show drafts"
              className="grid size-8 shrink-0 place-items-center rounded-[2px] text-ink transition hover:bg-ink/10 lg:hidden"
              onClick={() => setIsDraftsOpen(true)}
              type="button"
            >
              <Icon path="M4 6h16M4 12h16M4 18h10" />
            </button>
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-ink/20" />
            <div className="min-w-0 flex-1">
              <Breadcrumbs
                current={
                  <h1 className="truncate text-sm leading-tight font-medium text-ink">
                    {url ? draftTitle(url) : 'PDF editor'}
                  </h1>
                }
              >
                <OriginCrumb
                  origin={origin}
                  label={
                    origin.kind === 'search'
                      ? searchName
                      : origin.kind === 'project'
                        ? projects?.find(
                            (project) => project.publicId === origin.id,
                          )?.name
                        : undefined
                  }
                />
              </Breadcrumbs>
              {url && (
                <p className="truncate text-xs leading-tight text-ink/60">
                  {hostname(url)}
                </p>
              )}
            </div>
          </div>

          {pdf && (
            // The toolbar row, below the title and actions.
            <div className="order-last -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-2 overflow-x-auto border-t border-ink/15 px-3 py-1.5 sm:-mx-4 sm:w-[calc(100%+2rem)] sm:px-4">
              <SegmentGroup label="Add a field">
                {TOOLS.map(({ tool, label, icon, key }) => (
                  <SegmentButton
                    active={activeTool === tool}
                    key={tool}
                    onClick={() =>
                      setActiveTool((current) =>
                        current === tool ? undefined : tool,
                      )
                    }
                    title={`Add ${label.toLowerCase()} (${key.toUpperCase()})`}
                  >
                    <span
                      className={
                        activeTool === tool ? undefined : 'text-blueprint'
                      }
                    >
                      <Icon path={icon} />
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </SegmentButton>
                ))}
              </SegmentGroup>

              <SegmentGroup label="Zoom">
                <SegmentButton
                  disabled={scale <= ZOOM_STEPS[0]}
                  onClick={() => zoom(-1)}
                  title="Zoom out (−)"
                >
                  <Icon path="M6 12h12" />
                </SegmentButton>
                <SegmentButton
                  onClick={() =>
                    setScale(
                      fitWidthScale(scrollRef.current, pageWidthRef.current),
                    )
                  }
                  title="Fit to width"
                >
                  <span className="w-9 text-center tabular-nums">
                    {Math.round(scale * 100)}%
                  </span>
                </SegmentButton>
                <SegmentButton
                  disabled={scale >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                  onClick={() => zoom(1)}
                  title="Zoom in (+)"
                >
                  <Icon path="M12 6v12M6 12h12" />
                </SegmentButton>
              </SegmentGroup>

              {pdf.numPages > 1 && (
                <SegmentGroup label="Pages">
                  <SegmentButton
                    disabled={currentPage <= 1}
                    onClick={() => scrollToPage(currentPage - 1)}
                    title="Previous page"
                  >
                    <Icon path="m15 6-6 6 6 6" />
                  </SegmentButton>
                  <span className="grid h-8 place-items-center px-2 text-xs font-medium whitespace-nowrap text-ink tabular-nums">
                    {currentPage} / {pdf.numPages}
                  </span>
                  <SegmentButton
                    disabled={currentPage >= pdf.numPages}
                    onClick={() => scrollToPage(currentPage + 1)}
                    title="Next page"
                  >
                    <Icon path="m9 6 6 6-6 6" />
                  </SegmentButton>
                </SegmentGroup>
              )}

              {fieldCounts.total > 0 && (
                <button
                  className="group flex h-8 shrink-0 items-center gap-2 rounded-[2px] border border-ink/30 px-2.5 text-xs font-medium text-ink transition hover:border-ink disabled:cursor-default disabled:hover:border-ink/30"
                  disabled={fieldCounts.filled === fieldCounts.total}
                  onClick={focusNextEmptyField}
                  title="Go to the next empty field (N)"
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-12 overflow-hidden rounded-full bg-ink/15"
                  >
                    <span
                      className={`block h-full transition-[width] ${
                        fieldCounts.filled === fieldCounts.total
                          ? 'bg-success'
                          : 'bg-blueprint'
                      }`}
                      style={{
                        width: `${(fieldCounts.filled / fieldCounts.total) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="whitespace-nowrap tabular-nums">
                    {fieldCounts.filled}/{fieldCounts.total}
                  </span>
                  <span className="hidden whitespace-nowrap text-ink/70 group-enabled:group-hover:text-ink sm:inline">
                    {fieldCounts.filled === fieldCounts.total
                      ? 'All filled'
                      : 'Next empty'}
                  </span>
                  {fieldCounts.filled < fieldCounts.total && (
                    <Icon path="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  )}
                </button>
              )}
            </div>
          )}

          <div className="flex h-12 shrink-0 items-center gap-2">
            {pdf && (
              <>
                {signedIn && (
                  <ProjectFillMenu
                    projects={projects}
                    project={fillProject}
                    fillCounts={fillCounts}
                    onFill={fillFromProject}
                    item={{ sourceUrl: url, title: draftTitle(url) }}
                  />
                )}
                <div className="hidden sm:block">
                  <DraftStatusLabel
                    onDiscard={() => void discardDraft()}
                    signedIn={signedIn}
                    status={draftStatus}
                  />
                </div>
                <button
                  className="flex h-8 items-center gap-1.5 rounded-full bg-blueprint pr-3 pl-2.5 text-xs font-medium text-paper transition hover:bg-blueprint-deep disabled:opacity-50"
                  disabled={isSaving}
                  onClick={() => void downloadPdf()}
                  title="Download the filled PDF"
                  type="button"
                >
                  <Icon path="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  {isSaving ? 'Preparing…' : 'Download'}
                </button>
              </>
            )}
            <AccountMenu />
          </div>
        </div>

        {activeTool && (
          <p className="border-t border-blueprint/30 bg-blueprint/10 px-4 py-1 text-center text-xs font-medium text-blueprint">
            Click a page to place the {activeTool} field. Press Escape to
            cancel.
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-ink bg-paper lg:block">
          {sidebar}
        </aside>

        {isDraftsOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button
              aria-label="Close sidebar"
              className="absolute inset-0 bg-ink/40"
              onClick={() => setIsDraftsOpen(false)}
              type="button"
            />
            <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw] border-r border-ink bg-paper">
              {sidebar}
            </aside>
          </div>
        )}

        <section
          className={`relative min-w-0 flex-1 overflow-auto ${
            activeTool ? 'cursor-crosshair' : ''
          }`}
          ref={scrollRef}
        >
          {draftNotice && (
            <p
              className="sticky top-0 z-40 flex items-center justify-center gap-3 border-b border-blueprint bg-paper px-4 py-3 text-center text-sm text-blueprint"
              role="status"
            >
              {draftNotice}
              <button
                className="font-medium underline underline-offset-2"
                onClick={() => setDraftNotice('')}
                type="button"
              >
                Dismiss
              </button>
            </p>
          )}

          {isLoading ? (
            <div className="grid h-full place-items-center py-24">
              <p className="flex items-center gap-3 font-medium">
                <span className="size-4 spinner" />
                Preparing editor…
              </p>
            </div>
          ) : !url ? (
            <div className="mx-auto max-w-md px-4 py-24 text-center">
              <h2 className="text-2xl font-medium tracking-[-0.02em] text-ink">
                Choose a form to fill out
              </h2>
              <p className="mt-3 text-base leading-6 text-ink/70">
                Open one of your drafts, or search for your city’s permit forms
                and choose “Fill out this form” on a PDF result.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <a
                  className="rounded-full bg-blueprint px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blueprint-deep"
                  href="/"
                >
                  Search for a permit
                </a>
                <button
                  className="rounded-full border border-ink/35 px-5 py-2.5 text-sm font-medium transition hover:border-ink lg:hidden"
                  onClick={() => setIsDraftsOpen(true)}
                  type="button"
                >
                  Show drafts
                </button>
              </div>
            </div>
          ) : error && !pdf ? (
            <div className="px-4 py-16">
              <section className="mx-auto max-w-lg border border-redline bg-paper p-7 text-center">
                <h2 className="text-2xl font-medium">
                  This PDF could not be opened
                </h2>
                <p className="mt-3 text-base leading-6 text-ink/70">{error}</p>
                <a
                  className="mt-6 inline-flex rounded-full bg-blueprint px-5 py-3 text-sm font-medium text-paper"
                  href="/"
                >
                  Return to search
                </a>
              </section>
            </div>
          ) : (
            <div className="mx-auto flex w-max min-w-full flex-col items-center gap-7 px-4 py-8">
              {pdf &&
                Array.from({ length: pdf.numPages }, (_, pageIndex) => (
                  <EditorPage
                    activeTool={activeTool}
                    key={pageIndex}
                    nativeFields={nativeFields}
                    onNativeChange={updateNativeField}
                    onPlace={placeField}
                    onPlacedChange={updatePlacedField}
                    onPlacedDelete={(id) =>
                      setPlacedFields((current) =>
                        current.filter((field) => field.id !== id),
                      )
                    }
                    pageIndex={pageIndex}
                    pdf={pdf}
                    placedFields={placedFields}
                    scale={scale}
                  />
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function EditorPage({
  pdf,
  pageIndex,
  activeTool,
  nativeFields,
  placedFields,
  onPlace,
  onNativeChange,
  onPlacedChange,
  onPlacedDelete,
  scale,
}: {
  pdf: PDFDocumentProxy
  pageIndex: number
  activeTool?: EditorTool
  nativeFields: Array<NativeField>
  placedFields: Array<PlacedField>
  onPlace: (pageIndex: number, x: number, y: number) => void
  onNativeChange: (
    id: string,
    update: (field: NativeField) => NativeField,
  ) => void
  onPlacedChange: (id: string, value: string) => void
  onPlacedDelete: (id: string) => void
  // PDF.js render scale, from the zoom control.
  scale: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState<PDFPageProxy>()
  const [viewport, setViewport] = useState<PageViewport>()

  useEffect(() => {
    let cancelled = false
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined

    async function renderPage() {
      const loadedPage = await pdf.getPage(pageIndex + 1)
      const pageViewport = loadedPage.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      const outputScale = window.devicePixelRatio || 1
      canvas.width = Math.floor(pageViewport.width * outputScale)
      canvas.height = Math.floor(pageViewport.height * outputScale)
      canvas.style.width = `${pageViewport.width}px`
      canvas.style.height = `${pageViewport.height}px`
      const context = canvas.getContext('2d')
      if (!context) return

      renderTask = loadedPage.render({
        canvas,
        canvasContext: context,
        viewport: pageViewport,
        transform:
          outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0],
      })
      await renderTask.promise
      setPage(loadedPage)
      setViewport(pageViewport)
    }

    void renderPage()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pageIndex, pdf, scale])

  function handlePageClick(event: React.MouseEvent<HTMLDivElement>) {
    if (
      !activeTool ||
      !viewport ||
      (event.target as HTMLElement).closest('[data-editor-control]')
    ) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const [x, y] = viewport.convertToPdfPoint(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    )
    onPlace(pageIndex, x, y)
  }

  const pageNativeFields = nativeFields.flatMap((field) =>
    field.widgets
      .filter((widget) => widget.pageIndex === pageIndex)
      .map((widget) => ({ field, widget })),
  )

  return (
    <article className="scroll-mt-6" data-page={pageIndex + 1}>
      <p className="mb-2 text-center text-xs font-medium text-ink/55">
        Page {pageIndex + 1}
      </p>
      <div
        className="relative overflow-hidden bg-white shadow-[0_8px_30px_rgb(0_0_0/0.18)]"
        onClick={handlePageClick}
        style={
          viewport
            ? { width: viewport.width, height: viewport.height }
            : { width: 816, height: 1056 }
        }
      >
        <canvas className="absolute inset-0" ref={canvasRef} />
        {page &&
          viewport &&
          pageNativeFields.map(({ field, widget }) => (
            <NativeFieldControl
              field={field}
              key={`${field.id}-${widget.x}-${widget.y}`}
              onChange={(update) => onNativeChange(field.id, update)}
              style={rectStyle(widget, viewport)}
              widget={widget}
            />
          ))}
        {viewport &&
          placedFields
            .filter((field) => field.pageIndex === pageIndex)
            .map((field) => (
              <PlacedFieldControl
                field={field}
                key={field.id}
                onChange={(value) => onPlacedChange(field.id, value)}
                onDelete={() => onPlacedDelete(field.id)}
                style={rectStyle(field, viewport)}
              />
            ))}
      </div>
    </article>
  )
}

function NativeFieldControl({
  field,
  widget,
  style,
  onChange,
}: {
  field: NativeField
  widget: PdfRect
  style: React.CSSProperties
  onChange: (update: (field: NativeField) => NativeField) => void
}) {
  const className =
    'absolute border border-blueprint/60 bg-[#e9f4ff]/70 text-[#172635] outline-none focus:border-blueprint focus:ring-2 focus:ring-blueprint/25'

  if (field.kind === 'text') {
    const shared = {
      'data-editor-control': true,
      'data-field-id': field.id,
      className: `${className} px-1`,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => onChange((current) => ({ ...current, value: event.target.value })),
      style,
      value: field.value,
    }
    return field.multiline ? (
      <textarea {...shared} className={`${shared.className} resize-none`} />
    ) : (
      <input {...shared} type="text" />
    )
  }

  if (field.kind === 'checkbox') {
    return (
      <input
        checked={field.checked}
        className={`${className} accent-blueprint`}
        data-editor-control
        data-field-id={field.id}
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            checked: event.target.checked,
          }))
        }
        style={style}
        type="checkbox"
      />
    )
  }

  if (field.kind === 'multiple') {
    return (
      <select
        className={className}
        data-editor-control
        data-field-id={field.id}
        multiple
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            values: Array.from(
              event.target.selectedOptions,
              (option) => option.value,
            ),
          }))
        }
        style={style}
        value={field.values}
      >
        {field.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    )
  }

  if (field instanceof Object && widget.option) {
    return (
      <label
        className="absolute grid cursor-pointer place-items-center rounded-full border border-blueprint/60 bg-[#e9f4ff]/70"
        data-editor-control
        data-field-id={field.id}
        style={style}
        title={widget.option}
      >
        <input
          checked={field.value === widget.option}
          className="size-[70%] accent-blueprint"
          name={field.id}
          onChange={() =>
            onChange((current) => ({
              ...current,
              value: widget.option ?? '',
            }))
          }
          type="radio"
        />
      </label>
    )
  }

  return (
    <select
      className={className}
      data-editor-control
      data-field-id={field.id}
      onChange={(event) =>
        onChange((current) => ({ ...current, value: event.target.value }))
      }
      style={style}
      value={field.value}
    >
      <option value="">Select</option>
      {field.options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  )
}

function PlacedFieldControl({
  field,
  style,
  onChange,
  onDelete,
}: {
  field: PlacedField
  style: React.CSSProperties
  onChange: (value: string) => void
  onDelete: () => void
}) {
  return (
    <div
      className="group absolute border border-dashed border-redline bg-white/80"
      data-editor-control
      style={style}
    >
      {field.kind === 'check' ? (
        <button
          aria-label="Toggle checkmark"
          className="grid size-full place-items-center text-lg font-bold text-ink"
          onClick={() => onChange(field.value ? '' : 'X')}
          type="button"
        >
          {field.value}
        </button>
      ) : (
        <input
          aria-label={field.kind}
          autoFocus
          className={`size-full bg-transparent px-1 outline-none ${
            field.kind === 'signature' ? 'font-serif text-lg italic' : ''
          }`}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.kind === 'signature' ? 'Type signature' : ''}
          type={field.kind === 'date' ? 'date' : 'text'}
          value={field.value}
        />
      )}
      <button
        aria-label="Remove field"
        className="absolute -top-2 -right-2 hidden size-5 place-items-center rounded-full bg-redline text-xs text-paper group-hover:grid"
        onClick={onDelete}
        type="button"
      >
        ×
      </button>
    </div>
  )
}

// A row of joined toolbar buttons with thin dividers.
function SegmentGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      aria-label={label}
      className="flex shrink-0 items-center divide-x divide-ink/20 overflow-hidden rounded-[2px] border border-ink/30"
      role="group"
    >
      {children}
    </div>
  )
}

function SegmentButton({
  title,
  active = false,
  disabled,
  onClick,
  children,
}: {
  // Also the accessible name, since some segments show only an icon.
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={title}
      aria-pressed={active || undefined}
      className={`flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition disabled:opacity-30 ${
        active
          ? 'bg-blueprint text-paper'
          : 'text-ink hover:bg-ink/5 disabled:hover:bg-transparent'
      }`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

// An outline icon on a 24px grid.
function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  )
}

// `key` is the keyboard shortcut.
const TOOLS: Array<{
  tool: EditorTool
  label: string
  icon: string
  key: string
}> = [
  { tool: 'text', label: 'Text', key: 't', icon: 'M5 5h14M12 5v14' },
  { tool: 'check', label: 'Check', key: 'c', icon: 'm4.5 12.75 6 6 9-13.5' },
  {
    tool: 'date',
    label: 'Date',
    key: 'd',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  },
  {
    tool: 'signature',
    label: 'Signature',
    key: 's',
    icon: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125',
  },
]

const DRAFT_STATUS_TEXT: Record<DraftStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Draft saved',
  local: 'Saved on this device',
  error: 'Couldn’t save',
}

function DraftStatusLabel({
  status,
  signedIn,
  onDiscard,
}: {
  status: DraftStatus
  // When signed out, offer sign-in so the draft follows the user.
  signedIn: boolean
  onDiscard: () => void
}) {
  if (status === 'idle') return null

  return (
    <div
      aria-live="polite"
      className={`flex items-center gap-2 px-2 text-xs ${
        status === 'error' ? 'text-redline' : 'text-ink/60'
      }`}
    >
      {DRAFT_STATUS_TEXT[status]}
      {status === 'local' && !signedIn && (
        <SignInButton className="font-medium text-blueprint underline-offset-2 hover:underline">
          Sign in to keep it
        </SignInButton>
      )}
      {status !== 'saving' && (
        <button
          className="text-ink/60 underline-offset-2 hover:text-ink hover:underline"
          onClick={onDiscard}
          type="button"
        >
          Discard
        </button>
      )}
    </div>
  )
}

function nativeValuesOf(fields: Array<NativeField>) {
  const values: Record<string, NativeValue> = {}
  for (const field of fields) {
    values[field.name] =
      field.kind === 'checkbox'
        ? field.checked
        : field.kind === 'multiple'
          ? field.values
          : field.value
  }
  return values
}

// Puts saved values back by field name, skipping any whose type no longer
// matches, such as a field the city changed in a newer copy of the PDF.
function applyNativeValues(
  fields: Array<NativeField>,
  values: Record<string, NativeValue>,
): Array<NativeField> {
  return fields.map((field) => {
    const value = values[field.name]
    if (field.kind === 'checkbox') {
      return typeof value === 'boolean' ? { ...field, checked: value } : field
    }
    if (field.kind === 'multiple') {
      return Array.isArray(value)
        ? {
            ...field,
            values: value.filter((option) => field.options.includes(option)),
          }
        : field
    }
    if (typeof value !== 'string') return field
    if (field.kind === 'choice' && value && !field.options.includes(value)) {
      return field
    }
    return { ...field, value }
  })
}

async function fetchPdfBytes(url: string) {
  const response = await fetch(pdfProxyUrl(url))
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new UserError(payload?.error || 'The PDF could not be opened.')
  }
  return response.arrayBuffer()
}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function readNativeFields(bytes: ArrayBuffer) {
  const document = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const pages = document.getPages()

  return document
    .getForm()
    .getFields()
    .flatMap<NativeField>((field, fieldIndex) => {
      if (field.isReadOnly()) return []

      const widgets = field.acroField
        .getWidgets()
        .map<PdfRect | null>((widget, widgetIndex) => {
          const pageRef = widget.P()
          const pageIndex = pages.findIndex(
            (page) =>
              page.ref.tag === pageRef?.tag ||
              page.node
                .Annots()
                ?.asArray()
                .some(
                  (annotation) =>
                    annotation === document.context.getObjectRef(widget.dict),
                ),
          )
          if (pageIndex < 0 || (widget.getFlags() & (2 | 32)) !== 0) return null

          const rect = widget.getRectangle()
          const pdfRect: PdfRect = {
            pageIndex,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }
          if (field instanceof PDFRadioGroup) {
            pdfRect.option = field.getOptions()[widgetIndex]
          }
          return pdfRect
        })
        .filter((widget): widget is PdfRect => widget !== null)
      if (widgets.length === 0) return []

      const common = {
        id: `native-${fieldIndex}-${field.getName()}`,
        name: field.getName(),
        widgets,
      }
      if (field instanceof PDFTextField) {
        return [
          {
            ...common,
            kind: 'text',
            value: field.getText() ?? '',
            multiline: field.isMultiline(),
          },
        ]
      }
      if (field instanceof PDFCheckBox) {
        return [{ ...common, kind: 'checkbox', checked: field.isChecked() }]
      }
      if (field instanceof PDFDropdown) {
        return [
          {
            ...common,
            kind: 'choice',
            value: field.getSelected()[0] ?? '',
            options: field.getOptions(),
          },
        ]
      }
      if (field instanceof PDFRadioGroup) {
        return [
          {
            ...common,
            kind: 'choice',
            value: field.getSelected() ?? '',
            options: field.getOptions(),
          },
        ]
      }
      if (field instanceof PDFOptionList) {
        return [
          {
            ...common,
            kind: 'multiple',
            values: field.getSelected(),
            options: field.getOptions(),
          },
        ]
      }
      return []
    })
}

async function createEditedPdf(
  sourceBytes: ArrayBuffer,
  nativeFields: Array<NativeField>,
  placedFields: Array<PlacedField>,
) {
  const document = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const form = document.getForm()

  for (const model of nativeFields) {
    const field = form.getField(model.name)
    if (model.kind === 'text' && field instanceof PDFTextField) {
      field.setText(model.value)
    } else if (model.kind === 'checkbox' && field instanceof PDFCheckBox) {
      if (model.checked) field.check()
      else field.uncheck()
    } else if (model.kind === 'choice') {
      if (field instanceof PDFDropdown) {
        if (model.value) field.select(model.value)
        else field.clear()
      } else if (field instanceof PDFRadioGroup) {
        if (model.value) field.select(model.value)
        else field.clear()
      }
    } else if (model.kind === 'multiple' && field instanceof PDFOptionList) {
      if (model.values.length) field.select(model.values)
      else field.clear()
    }
  }

  try {
    form.updateFieldAppearances()
  } catch {
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True)
  }

  const [regularFont, signatureFont] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(StandardFonts.HelveticaOblique),
  ])
  const pages = document.getPages()
  for (const field of placedFields) {
    if (!field.value) continue
    if (field.pageIndex < 0 || field.pageIndex >= pages.length) continue
    const page = pages[field.pageIndex]

    page.drawText(field.value, {
      x: field.x + 2,
      y: field.y + Math.max(3, (field.height - 12) / 2),
      size: field.kind === 'signature' ? 16 : 12,
      font: field.kind === 'signature' ? signatureFont : regularFont,
      color: rgb(0.12, 0.12, 0.12),
      maxWidth: field.width - 4,
    })
  }

  return document.save({ updateFieldAppearances: false })
}

function rectStyle(rect: PdfRect, viewport: PageViewport) {
  const [x1, y1] = viewport.convertToViewportPoint(rect.x, rect.y)
  const [x2, y2] = viewport.convertToViewportPoint(
    rect.x + rect.width,
    rect.y + rect.height,
  )
  const height = Math.abs(y2 - y1)
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height,
    // Text scales with zoom but stays readable in short fields.
    fontSize: Math.max(9, Math.min(height * 0.65, 11 * viewport.scale)),
  }
}

// The zoom that fits page 1 across the editor, within normal zoom limits.
function fitWidthScale(container: HTMLElement | null, pageWidth: number) {
  const available = (container?.clientWidth ?? 900) - 64
  const fitted = Math.round((available / pageWidth) * 20) / 20
  return Math.min(Math.max(fitted, ZOOM_STEPS[0]), 1.75)
}

function isFilled(field: NativeField) {
  if (field.kind === 'checkbox') return field.checked
  if (field.kind === 'multiple') return field.values.length > 0
  return field.value.trim() !== ''
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function pdfProxyUrl(sourceUrl: string) {
  return `/api/pdf?url=${encodeURIComponent(sourceUrl)}`
}

function localDateValue() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function pdfFilename(sourceUrl: string) {
  try {
    const filename = decodeURIComponent(
      new URL(sourceUrl).pathname.split('/').at(-1) ?? 'permit',
    )
    return filename.replace(/\.pdf$/i, '') || 'permit'
  } catch {
    return 'permit'
  }
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}
