import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { SidebarBrand } from '#/components/AppSidebar'
import { Breadcrumbs, OriginCrumb } from '#/components/Breadcrumbs'
import { DraftSidebar } from '#/components/DraftSidebar'
import { AutofillPanel } from '#/components/AutofillPanel'
import type { AutofillFill, AutofillState } from '#/components/AutofillPanel'
import { FormCheckPanel } from '#/components/FormCheckPanel'
import type { FormCheckState } from '#/components/FormCheckPanel'
import { FormPanel } from '#/components/FormPanel'
import type { FormPanelTab } from '#/components/FormPanel'
import { PermitSearchLogo } from '#/components/PermitSearchLogo'
import { SignInButton } from '#/components/SignInDialog'
import { useResumeAfterSignIn } from '#/lib/auth/resume'
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
import type { FieldIssue, IssueSeverity } from '#/lib/forms/checks'
import {
  checkFormDraft,
  findPageBoxes,
  prepareFormSchema,
} from '#/lib/forms/forms'
import {
  exclusiveOptions,
  selectOption,
  selectedOption,
} from '#/lib/pdf/exclusive-checkbox'
import { boxValue, codeMatches, fillOptions } from '#/lib/projects/autofill'
import type { Project } from '#/lib/projects/types'
import { useAccountProjects } from '#/lib/projects/use-account-projects'
import { parseOrigin, searchLabel } from '#/lib/navigation/origin'
import type { Origin } from '#/lib/navigation/origin'
import { useSidebarCollapsed } from '#/lib/navigation/sidebar'
import { getSearchSummary } from '#/lib/search/permit-search'
import { confirm } from '#/components/ConfirmDialog'

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
      // Drawn as checkboxes: the PDF builds its answers as a checkbox per
      // answer, of which only one can be on.
      asCheckboxes?: boolean
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

// project: the project to fill from. from: the page it was opened from, for
// the breadcrumb; see Origin. page: the page in view, so a reload or shared
// link opens there; left out on page 1.
const editorSearchSchema = z.object({
  url: z.string().catch(''),
  project: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
})

export const Route = createFileRoute('/editor')({
  validateSearch: editorSearchSchema,
  loaderDeps: ({ search }) => ({ from: search.from }),
  // The search the editor was opened from, to name it in the breadcrumb. A
  // failed lookup just leaves the breadcrumb generic.
  loader: async ({ deps }) => {
    const origin = parseOrigin(deps.from)

    if (origin?.kind !== 'search') return { searchName: undefined }

    const summary = await getSearchSummary({
      data: { slug: origin.slug },
    }).catch(() => null)

    return { searchName: summary ? searchLabel(summary) : undefined }
  },
  component: EditorRoute,
})

// Keyed by URL so opening another draft starts with fresh state, and the
// closing editor saves any pending edit.
function EditorRoute() {
  const { url, project, from, page } = Route.useSearch()
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
      initialPage={page}
    />
  )
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5]

function PdfEditor({
  url,
  projectId,
  origin,
  searchName,
  initialPage,
}: {
  url: string
  projectId?: string
  origin: Origin
  searchName?: string
  initialPage?: number
}) {
  const navigate = useNavigate({ from: '/editor' })
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
  // The user's name for the draft, shown in place of the form's file name.
  const [draftName, setDraftName] = useState<string>()
  // PDF.js render scale; 1 is the PDF's size at 72 DPI.
  const [scale, setScale] = useState(1.25)
  const [currentPage, setCurrentPage] = useState(1)
  const { isCollapsed: isSidebarCollapsed } = useSidebarCollapsed()
  // The drafts drawer on small screens; the sidebar is always shown on large.
  const [isDraftsOpen, setIsDraftsOpen] = useState(false)
  const { projects } = useAccountProjects(signedIn)
  // The project chosen in the Autofill tab, or the one the editor was opened from.
  const [fillProjectId, setFillProjectId] = useState(projectId)
  // Each field's printed label, by field name, once the server has read the
  // form; autofill reads them along with the field names.
  const [formLabels, setFormLabels] = useState<Record<string, string>>({})
  // The last Autofill: what it filled and what it couldn't.
  const [autofill, setAutofill] = useState<AutofillState>()
  // The last form check, and the entries it checked, to tell when it's out
  // of date.
  const [formCheck, setFormCheck] = useState<FormCheckState>()
  const [checkedContent, setCheckedContent] = useState<string>()
  // The user downloaded without a current check; rings the Check button until
  // they open it.
  const [isCheckNudged, setIsCheckNudged] = useState(false)
  // The side panel's open tab, if it's open.
  const [panelTab, setPanelTab] = useState<FormPanelTab>()
  const scrollRef = useRef<HTMLElement>(null)
  // Page 1's width at scale 1, for fitting the page to the window.
  const pageWidthRef = useRef(612)

  // The project Autofill fills from: the one chosen in its tab (or opened
  // from), else the one holding this PDF. None when the PDF isn't in a
  // project, so Autofill asks which to use instead of guessing.
  const fillProject =
    projects?.find((project) => project.publicId === fillProjectId) ??
    projects?.find((project) =>
      project.items.some((item) => item.sourceUrl === url),
    )

  // The text fields, which a project can fill when they're empty.
  const textFields = useMemo(
    () =>
      nativeFields.flatMap((field) =>
        field.kind === 'text'
          ? [
              {
                id: field.id,
                name: field.name,
                label: formLabels[field.name] ?? '',
                width: field.widgets[0].width,
                pageIndex: field.widgets[0].pageIndex,
                isEmpty: !field.value.trim(),
              },
            ]
          : [],
      ),
    [nativeFields, formLabels],
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
    searchSlug: origin.kind === 'search' ? origin.slug : undefined,
  })

  // Signed out, Autofill and Check ask for sign-in; this opens the one they
  // chose once they have. It opens rather than runs, so they see the panel's
  // own button and what it will do.
  useResumeAfterSignIn(`autofill:${url}`, signedIn, () =>
    setPanelTab('autofill'),
  )
  useResumeAfterSignIn(`form-check:${url}`, signedIn, () =>
    setPanelTab('check'),
  )

  // Reads the form on the server as soon as it opens, so checking is quick
  // and autofill knows each field's label. A failure here only means the
  // check button does the work later. Signed out, neither is available.
  const hasNativeFields = nativeFields.length > 0
  useEffect(() => {
    if (!signedIn || !sourceHash || !hasNativeFields) return

    let cancelled = false

    prepareFormSchema({ data: { sourceUrl: url, sourceHash } })
      .then(({ labels }) => {
        if (!cancelled) setFormLabels(labels)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [signedIn, url, sourceHash, hasNativeFields])

  // The project the form is checked against: the one it's in, else the one
  // chosen in the Autofill tab or opened from.
  const checkProject =
    projects?.find((project) =>
      project.items.some((item) => item.sourceUrl === url),
    ) ?? projects?.find((project) => project.publicId === fillProjectId)

  const contentKey = useMemo(() => JSON.stringify(draftContent), [draftContent])

  const shownCheck: FormCheckState | undefined =
    formCheck?.status === 'done'
      ? { ...formCheck, stale: checkedContent !== contentKey }
      : formCheck

  // The number of findings when the check matches the form's entries.
  const currentIssueCount =
    shownCheck?.status === 'done' && !shownCheck.stale
      ? shownCheck.result.issues.length
      : undefined

  // There's something to check, and no check has looked at it yet.
  const needsCheck =
    currentIssueCount === undefined &&
    formCheck?.status !== 'checking' &&
    (placedFields.some(({ value }) => value.trim()) ||
      nativeFields.some((field) =>
        field.kind === 'checkbox'
          ? field.checked
          : field.kind === 'multiple'
            ? field.values.length > 0
            : field.value.trim(),
      ))

  // The fields with findings, by native field name or placed field ID, while
  // the check is current.
  const flaggedFields = useMemo(() => {
    const flagged = new Map<string, IssueSeverity>()

    if (formCheck?.status !== 'done' || checkedContent !== contentKey) {
      return flagged
    }

    for (const issue of formCheck.result.issues) {
      const { target } = issue

      const key =
        target.kind === 'native'
          ? target.name
          : target.kind === 'placed'
            ? target.id
            : undefined

      if (key && !(flagged.get(key) === 'error')) {
        flagged.set(key, issue.severity)
      }
    }

    return flagged
  }, [formCheck, checkedContent, contentKey])

  async function checkForm() {
    if (!sourceHash) return

    setPanelTab('check')
    setIsCheckNudged(false)
    setFormCheck({ status: 'checking' })
    const checked = contentKey

    try {
      const result = await checkFormDraft({
        data: {
          sourceUrl: url,
          sourceHash,
          content: draftContent,
          projectId: checkProject?.publicId,
        },
      })

      setCheckedContent(checked)
      setFormCheck({ status: 'done', result, stale: false })
    } catch (checkError) {
      setFormCheck({
        status: 'failed',
        message: errorMessage(checkError, 'The form couldn’t be checked.'),
      })
    }
  }

  // Scrolls to a field and focuses it. Small screens close the panel, which
  // would otherwise cover it.
  function showField(fieldId: string | undefined, pageIndex: number) {
    if (!window.matchMedia('(min-width: 64rem)').matches) {
      setPanelTab(undefined)
    }

    const element = fieldId
      ? scrollRef.current?.querySelector<HTMLElement>(
          `[data-field-id="${CSS.escape(fieldId)}"]`,
        )
      : null

    if (!element) {
      scrollToPage(pageIndex + 1)

      return
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.focus({ preventScroll: true })
  }

  // Opens a tab of the side panel, or closes the panel if it's already showing.
  function togglePanel(tab: FormPanelTab) {
    if (tab === 'check') setIsCheckNudged(false)

    setPanelTab((current) => (current === tab ? undefined : tab))
  }

  // Goes to the field a finding is about.
  function showIssue(issue: FieldIssue) {
    const { target } = issue

    showField(
      target.kind === 'native'
        ? nativeFields.find((field) => field.name === target.name)?.id
        : target.kind === 'placed'
          ? target.id
          : undefined,
      issue.pageIndex,
    )
  }

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
          setDraftName(saved?.draft.name)

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
          if (!(entry.target instanceof HTMLElement)) continue
          const page = Number(entry.target.dataset.page)

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

  // Opens on the page in the URL when the PDF loads; later scrolling moves the
  // URL instead. Earlier pages may still be sizing; the browser's scroll
  // anchoring keeps this one in view as they do.
  const initialPageRef = useRef(initialPage)
  useEffect(() => {
    const page = initialPageRef.current

    if (!pdf || !page) return
    scrollRef.current
      ?.querySelector(`[data-page="${Math.min(page, pdf.numPages)}"]`)
      ?.scrollIntoView({ block: 'start' })
  }, [pdf])

  // Keeps ?page= on the page in view, once scrolling settles.
  useEffect(() => {
    if (!pdf) return

    const timer = window.setTimeout(() => {
      void navigate({
        search: (previous) => ({
          ...previous,
          page: currentPage > 1 ? currentPage : undefined,
        }),
        replace: true,
        resetScroll: false,
      })
    }, 400)

    return () => window.clearTimeout(timer)
  }, [currentPage, pdf, navigate])

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

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveTool(undefined)

        return
      }

      // Leave typing in fields and browser shortcuts alone.
      const { target } = event

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (target instanceof Element &&
          target.closest('input, textarea, select, [contenteditable="true"]'))
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

  function fillEmptyFields(fills: Array<AutofillFill>) {
    const values = new Map(fills.map((fill) => [fill.fieldId, fill.value]))

    setNativeFields((current) =>
      current.map((field) =>
        field.kind === 'text' && !field.value.trim() && values.has(field.id)
          ? { ...field, value: values.get(field.id) ?? '' }
          : field,
      ),
    )
  }

  // Asks Jev, a page at a time, for the boxes of the values code couldn't place.
  async function findBoxesWithJev(
    project: Project,
    optionIds: Array<string>,
    boxes: typeof textFields,
  ) {
    const filled: Array<AutofillFill> = []
    const foundOptionIds = new Set<string>()
    const failedPages: Array<number> = []

    if (!pdf || !sourceHash) {
      return { filled, foundOptionIds, failedPages, skippedPages: [] }
    }

    const options = new Map(
      fillOptions(project).map((option) => [option.id, option]),
    )

    const boxesByName = new Map(boxes.map((box) => [box.name, box]))

    const allPages = [...new Set(boxes.map((box) => box.pageIndex))].sort(
      (a, b) => a - b,
    )

    const pages = allPages.slice(0, AUTOFILL_MAX_PAGES)

    for (
      let start = 0;
      start < pages.length;
      start += AUTOFILL_PAGES_AT_ONCE
    ) {
      await Promise.all(
        pages
          .slice(start, start + AUTOFILL_PAGES_AT_ONCE)
          .map(async (pageIndex) => {
            try {
              const { matches } = await findPageBoxes({
                data: {
                  sourceUrl: url,
                  sourceHash,
                  projectId: project.publicId,
                  pageIndex,
                  pageImage: await renderPageImage(pdf, pageIndex),
                  fieldNames: boxes.flatMap((box) =>
                    box.pageIndex === pageIndex ? [box.name] : [],
                  ),
                  optionIds,
                },
              })

              const pageFills = matches.flatMap(({ boxName, optionId }) => {
                const box = boxesByName.get(boxName)
                const option = options.get(optionId)

                if (!box || !option) return []

                foundOptionIds.add(optionId)

                return [
                  {
                    fieldId: box.id,
                    pageIndex,
                    label: option.label,
                    value: boxValue(option, box.width),
                  },
                ]
              })

              console.info(`[autofill] page ${pageIndex + 1}`, { matches })

              fillEmptyFields(pageFills)
              filled.push(...pageFills)
            } catch (cause) {
              console.error(`[autofill] page ${pageIndex + 1} failed`, cause)
              failedPages.push(pageIndex + 1)
            }
          }),
      )
    }

    return {
      filled,
      foundOptionIds,
      failedPages: failedPages.sort((a, b) => a - b),
      skippedPages: allPages
        .slice(AUTOFILL_MAX_PAGES)
        .map((pageIndex) => pageIndex + 1),
    }
  }

  // Autofill: fills what code can place, then asks Jev where the rest goes, and
  // shows the results in the side panel.
  async function fillFromProject(project: Project) {
    if (autofill?.status === 'filling') return

    const code = codeMatches(textFields, project)

    const codeFills = textFields.flatMap((field) => {
      const fill = code.fills.get(field.id)

      return fill
        ? [{ fieldId: field.id, pageIndex: field.pageIndex, ...fill }]
        : []
    })

    fillEmptyFields(codeFills)

    const remaining = fillOptions(project).filter(
      ({ id }) => !code.placedOptionIds.has(id),
    )

    const boxes = textFields.filter(
      (field) => field.isEmpty && !code.fills.has(field.id),
    )

    console.info('[autofill] code matched', {
      filled: codeFills.length,
      leftForJev: remaining.map(({ label }) => label),
      emptyBoxes: boxes.length,
    })

    const projectName = project.name

    setAutofill({ status: 'filling', projectName })

    const jev =
      remaining.length > 0 && boxes.length > 0
        ? await findBoxesWithJev(
            project,
            remaining.map(({ id }) => id),
            boxes,
          )
        : undefined

    setAutofill({
      status: 'done',
      projectName,
      filled: [...codeFills, ...(jev?.filled ?? [])].sort(
        (a, b) => a.pageIndex - b.pageIndex,
      ),
      notFound: remaining
        .filter(({ id }) => !jev?.foundOptionIds.has(id))
        .map(({ label }) => label),
      failedPages: jev?.failedPages ?? [],
      skippedPages: jev?.skippedPages ?? [],
    })
  }

  // Clears only the fields still holding the filled value, so later typing is
  // kept.
  function undoAutofill() {
    if (autofill?.status !== 'done') return

    const values = new Map(
      autofill.filled.map((fill) => [fill.fieldId, fill.value]),
    )

    setNativeFields((current) =>
      current.map((field) =>
        field.kind === 'text' && values.get(field.id) === field.value
          ? { ...field, value: '' }
          : field,
      ),
    )
    setAutofill(undefined)
  }

  // Clears everything entered: deletes the saved draft and puts back the PDF's
  // own values.
  async function clearForm() {
    if (!sourceBytes) return

    if (
      !(await confirm({
        title: 'Clear this form?',
        message:
          'This removes everything you’ve entered and any fields you’ve added. It can’t be undone.',
        confirmLabel: 'Clear form',
        isDestructive: true,
      }))
    ) {
      return
    }

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
      setAutofill(undefined)
      setFormCheck(undefined)
      setIsCheckNudged(false)
    } catch (clearError) {
      toast.error(errorMessage(clearError, 'The form couldn’t be cleared.'))
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

      // The download is the app's last step, so say what comes next: the
      // user files with the city; adding the permit number only tracks it.
      const holdingProject = projects?.find((project) =>
        project.items.some((item) => item.sourceUrl === url),
      )

      toast('Next, submit this form to the city yourself.', {
        description: holdingProject
          ? 'File it on the city’s permit portal, by email or in person. Then add the permit number the city gives you to the project to track its status.'
          : 'File it on the city’s permit portal, by email or in person. To track the permit’s status, add this form to a project, then add the permit number the city gives you.',
        duration: 12_000,
        action: holdingProject && {
          label: 'Open project',
          onClick: () =>
            void navigate({
              to: '/projects/$projectId',
              params: { projectId: holdingProject.publicId },
            }),
        },
      })

      if (needsCheck) setIsCheckNudged(true)
    } catch (saveError) {
      toast.error(
        errorMessage(saveError, 'The edited PDF couldn’t be created.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Framed like AppSidebar (its logo and account row) around a file browser
  // of the PDFs, on plain paper: these are files, not pages of the app. Only
  // the desktop panel collapses; the phone drawer is already out of the way.
  function renderSidebar({ inDrawer }: { inDrawer: boolean }) {
    const isCollapsed = !inDrawer && isSidebarCollapsed

    return (
      <>
        <SidebarBrand isCollapsed={isCollapsed} />
        <DraftSidebar
          currentUrl={url}
          signedIn={signedIn}
          refreshKey={draftStatus}
          onNavigate={() => setIsDraftsOpen(false)}
          isCollapsed={isCollapsed}
          canCollapse={!inDrawer}
        />
        {signedIn && (
          <div className="shrink-0 pt-8">
            <AccountMenu variant="sidebar" isCollapsed={isCollapsed} />
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`hidden shrink-0 flex-col bg-paper rule-r lg:flex ${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderSidebar({ inDrawer: false })}
      </aside>

      {isDraftsOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            aria-label="Close sidebar"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setIsDraftsOpen(false)}
            type="button"
          />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col bg-paper rule-r">
            {renderSidebar({ inDrawer: true })}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* One bar, two grid cells tall from lg up, its rule running on from
            the sidebar logo's: the title, then saving and download. The tools
            float over the desk below it. */}
        <header className="z-50 shrink-0 bg-sheet rule-b">
          <div className="flex h-12 items-center gap-x-2 px-3 sm:px-4 lg:h-16 lg:gap-x-4 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Link
                aria-label="Permit Search home"
                className="shrink-0 text-ink lg:hidden"
                to="/"
              >
                <PermitSearchLogo className="size-7" />
              </Link>
              <button
                aria-expanded={isDraftsOpen}
                aria-label="Show drafts"
                className="grid size-8 shrink-0 place-items-center rounded-xs text-ink transition hover:bg-ink/10 lg:hidden"
                onClick={() => setIsDraftsOpen(true)}
                type="button"
              >
                <Icon path="M4 6h16M4 12h16M4 18h10" />
              </button>
              <span
                aria-hidden="true"
                className="h-5 w-px shrink-0 bg-ink/20 lg:hidden"
              />
              <div className="min-w-0 flex-1">
                <Breadcrumbs
                  current={
                    <h1 className="truncate text-sm leading-tight font-medium text-ink">
                      {url ? (draftName ?? draftTitle(url)) : 'PDF editor'}
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

            <div className="flex shrink-0 items-center gap-2">
              {pdf && (
                <>
                  {signedIn ? (
                    <button
                      aria-expanded={panelTab === 'autofill'}
                      aria-label="Autofill"
                      className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition sm:pr-3 ${
                        panelTab === 'autofill'
                          ? 'border-blueprint bg-blueprint/10 text-blueprint'
                          : 'border-ink/35 text-ink hover:border-ink'
                      }`}
                      onClick={() => togglePanel('autofill')}
                      title="Show Autofill"
                      type="button"
                    >
                      <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                      <span className="hidden sm:inline">Autofill</span>
                    </button>
                  ) : (
                    <SignInButton
                      ariaLabel="Autofill"
                      className="flex h-8 items-center gap-1.5 rounded-full border border-ink/35 px-2.5 text-xs font-medium text-ink transition hover:border-ink sm:pr-3"
                      reason="Sign in to keep your details in a project and fill forms from it."
                      resume={`autofill:${url}`}
                      title="Fill this form from a project"
                    >
                      <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                      <span className="hidden sm:inline">Autofill</span>
                    </SignInButton>
                  )}
                  <div className="hidden sm:block">
                    <DraftStatusLabel
                      onDiscard={() => void clearForm()}
                      signedIn={signedIn}
                      status={draftStatus}
                    />
                  </div>
                  {signedIn ? (
                    <button
                      aria-expanded={panelTab === 'check'}
                      className={`flex h-8 items-center gap-1.5 rounded-full border pr-3 pl-2.5 text-xs font-medium whitespace-nowrap transition disabled:opacity-50 ${
                        panelTab === 'check'
                          ? 'border-blueprint bg-blueprint/10 text-blueprint'
                          : currentIssueCount === 0
                            ? 'border-success/50 text-success hover:border-success'
                            : currentIssueCount
                              ? 'border-redline/50 text-redline hover:border-redline'
                              : 'border-ink/35 text-ink hover:border-ink'
                      } ${isCheckNudged ? 'ring-2 ring-blueprint/40' : ''}`}
                      disabled={!sourceHash}
                      onClick={() => togglePanel('check')}
                      title={
                        needsCheck
                          ? 'Not checked yet. Look for mistakes before you submit.'
                          : 'Show the form check'
                      }
                      type="button"
                    >
                      <Icon path="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      {formCheck?.status === 'checking'
                        ? 'Checking…'
                        : currentIssueCount === 0
                          ? 'No issues'
                          : currentIssueCount
                            ? `${currentIssueCount} to review`
                            : 'Check'}
                      {needsCheck && (
                        <span
                          aria-label="Not checked yet"
                          className="size-1.5 rounded-full bg-blueprint"
                          role="img"
                        />
                      )}
                    </button>
                  ) : (
                    <SignInButton
                      className="flex h-8 items-center gap-1.5 rounded-full border border-ink/35 pr-3 pl-2.5 text-xs font-medium whitespace-nowrap text-ink transition hover:border-ink"
                      reason="Sign in to check this form for mistakes before you submit it."
                      resume={`form-check:${url}`}
                      title="Look for mistakes before you submit"
                    >
                      <Icon path="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      Check
                    </SignInButton>
                  )}
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
              {/* Signed in, the sidebar's account row has it from lg up. */}
              <div className={signedIn ? 'lg:hidden' : ''}>
                <AccountMenu hideVisitorMenu />
              </div>
            </div>
          </div>
        </header>

        <section
          className={`relative min-h-0 flex-1 overflow-auto bg-desk ${
            activeTool ? 'cursor-crosshair' : ''
          }`}
          ref={scrollRef}
        >
          {/* The tools: a second row that floats over the desk and stays as
              the pages scroll, with notices under it. It's an object on the
              desk rather than a bar, so the top bar keeps its height and its
              rule stays on the grid. Clicks between its parts reach the
              page. */}
          <div className="pointer-events-none sticky top-0 z-40 flex flex-col items-center gap-2 px-3 pt-3">
            {pdf && (
              <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-xs border border-ink bg-paper p-1.5">
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
                      <span className="hidden sm:inline">
                        {label}
                      </span>
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

                <button
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-xs border border-ink/30 px-2.5 text-xs font-medium whitespace-nowrap text-ink transition hover:border-redline hover:text-redline disabled:opacity-50"
                  disabled={!sourceBytes || autofill?.status === 'filling'}
                  onClick={() => void clearForm()}
                  title="Clear everything you’ve entered on this form"
                  type="button"
                >
                  Clear form
                </button>
              </div>
            )}

            {activeTool && (
              <p className="pointer-events-auto rounded-full bg-blueprint px-4 py-1.5 text-center text-xs font-medium text-paper">
                Click a page to place the {activeTool} field. Press Escape to
                cancel.
              </p>
            )}

            {draftNotice && (
              <p
                className="pointer-events-auto flex items-center justify-center gap-3 rounded-xs border border-blueprint bg-paper px-4 py-2 text-center text-sm text-blueprint"
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
          </div>

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
                    flaggedFields={flaggedFields}
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

      {/* Signing out with it open leaves nothing it can do. */}
      {signedIn && panelTab && (
        <>
          <button
            aria-label="Close panel"
            className="fixed inset-0 z-[60] bg-ink/40 lg:hidden"
            onClick={() => setPanelTab(undefined)}
            type="button"
          />
          <aside className="fixed inset-y-0 right-0 z-[60] flex w-80 max-w-[85vw] flex-col border-l border-ink bg-paper lg:static lg:z-auto lg:max-w-none lg:shrink-0">
            <FormPanel
              tab={panelTab}
              onTab={setPanelTab}
              onClose={() => setPanelTab(undefined)}
            >
              {panelTab === 'autofill' ? (
                <AutofillPanel
                  state={autofill}
                  emptyBoxes={
                    textFields.filter((field) => field.isEmpty).length
                  }
                  projects={projects}
                  project={fillProject}
                  item={{ sourceUrl: url, title: draftTitle(url) }}
                  onChoose={setFillProjectId}
                  onFill={() => {
                    if (fillProject) void fillFromProject(fillProject)
                  }}
                  onUndo={undoAutofill}
                  onSelect={(fill) => showField(fill.fieldId, fill.pageIndex)}
                />
              ) : (
                <FormCheckPanel
                  state={shownCheck}
                  onCheck={() => void checkForm()}
                  onSelect={showIssue}
                />
              )}
            </FormPanel>
          </aside>
        </>
      )}
    </div>
  )
}

function EditorPage({
  pdf,
  pageIndex,
  activeTool,
  flaggedFields,
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
  // Fields the last form check found problems with, by native field name or
  // placed field ID.
  flaggedFields: Map<string, IssueSeverity>
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
      (event.target instanceof Element &&
        event.target.closest('[data-editor-control]'))
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
              flag={flaggedFields.get(field.name)}
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
                flag={flaggedFields.get(field.id)}
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
  flag,
  widget,
  style,
  onChange,
}: {
  field: NativeField
  flag?: IssueSeverity
  widget: PdfRect
  style: React.CSSProperties
  onChange: (update: (field: NativeField) => NativeField) => void
}) {
  const className = `absolute border border-blueprint/60 bg-[#e9f4ff]/70 text-[#172635] outline-none focus:border-blueprint focus:ring-2 focus:ring-blueprint/25 ${flagClass(flag)}`

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

  if (field.asCheckboxes && widget.option) {
    return (
      <input
        checked={field.value === widget.option}
        className={`${className} accent-blueprint`}
        data-editor-control
        data-field-id={field.id}
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            value: event.target.checked ? (widget.option ?? '') : '',
          }))
        }
        style={style}
        title={widget.option}
        type="checkbox"
      />
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
  flag,
  style,
  onChange,
  onDelete,
}: {
  field: PlacedField
  flag?: IssueSeverity
  style: React.CSSProperties
  onChange: (value: string) => void
  onDelete: () => void
}) {
  return (
    <div
      className={`group absolute border border-dashed border-redline bg-white/80 ${flagClass(flag)}`}
      data-editor-control
      data-field-id={field.id}
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

// An outline around a field the form check flagged: solid redline for a
// likely mistake or a missing entry, faint for one worth a look.
function flagClass(flag?: IssueSeverity) {
  if (!flag) return ''

  return flag === 'review'
    ? 'outline-2 outline-offset-1 outline-redline/45'
    : 'outline-2 outline-offset-1 outline-redline'
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
      className="flex shrink-0 items-center divide-x divide-ink/20 overflow-hidden rounded-xs border border-ink/30"
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
      return value === true || value === false
        ? { ...field, checked: value }
        : field
    }

    if (field.kind === 'multiple') {
      return Array.isArray(value)
        ? {
            ...field,
            values: value.filter((option) => field.options.includes(option)),
          }
        : field
    }

    // Left: text, or nothing saved for the field.
    if (
      value === undefined ||
      value === true ||
      value === false ||
      Array.isArray(value)
    ) {
      return field
    }

    if (field.kind === 'choice' && value && !field.options.includes(value)) {
      return field
    }

    return { ...field, value }
  })
}

// The PDF proxy's error response.
const pdfErrorSchema = z.object({ error: z.string() })

// Pages autofill sends to Jev per press, and how many at a time.
const AUTOFILL_MAX_PAGES = 12
const AUTOFILL_PAGES_AT_ONCE = 3

// Jev rejects images with a side over this many pixels.
const MAX_PAGE_IMAGE_SIDE = 1568

// A page as a base64 JPEG for Jev. Rendered without form fields, so it shows the
// blank form and none of the values typed into it.
async function renderPageImage(pdf: PDFDocumentProxy, pageIndex: number) {
  const page = await pdf.getPage(pageIndex + 1)
  const { width, height } = page.getViewport({ scale: 1 })

  const viewport = page.getViewport({
    scale: MAX_PAGE_IMAGE_SIDE / Math.max(width, height),
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const context = canvas.getContext('2d')

  if (!context) throw new UserError('This page couldn’t be read.')

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    annotationMode: 0,
  }).promise

  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? ''
}

async function fetchPdfBytes(url: string) {
  const response = await fetch(pdfProxyUrl(url))

  if (!response.ok) {
    const payload = pdfErrorSchema.safeParse(
      await response.json().catch(() => null),
    )

    throw new UserError(
      (payload.success && payload.data.error) || 'The PDF could not be opened.',
    )
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

      // A Yes/No built as a checkbox with a box per answer acts as a radio group.
      const exclusive =
        field instanceof PDFCheckBox ? exclusiveOptions(field) : null

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
          } else if (exclusive) {
            pdfRect.option = exclusive[widgetIndex]
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
        return exclusive
          ? [
              {
                ...common,
                kind: 'choice',
                value: selectedOption(field),
                options: exclusive,
                asCheckboxes: true,
              },
            ]
          : [{ ...common, kind: 'checkbox', checked: field.isChecked() }]
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
      } else if (field instanceof PDFCheckBox) {
        selectOption(field, model.value)
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

// Just the view's bytes, copied into a plain ArrayBuffer for the Blob.
function toArrayBuffer(bytes: Uint8Array) {
  return new Uint8Array(bytes).buffer
}
