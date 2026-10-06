import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
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

type EditorTool = 'text' | 'check' | 'date' | 'signature'

interface PdfRect {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  option?: string
}

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

interface PlacedField extends PdfRect {
  id: string
  kind: EditorTool
  value: string
}

export const Route = createFileRoute('/editor')({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === 'string' ? search.url : '',
  }),
  component: PdfEditor,
})

function PdfEditor() {
  const { url } = Route.useSearch()
  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer>()
  const [pdf, setPdf] = useState<PDFDocumentProxy>()
  const [nativeFields, setNativeFields] = useState<Array<NativeField>>([])
  const [placedFields, setPlacedFields] = useState<Array<PlacedField>>([])
  const [activeTool, setActiveTool] = useState<EditorTool>()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    let loadedPdf: PDFDocumentProxy | undefined

    async function load() {
      if (!url) {
        setError('No PDF was selected.')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(pdfProxyUrl(url))
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(payload?.error || 'The PDF could not be opened.')
        }

        const bytes = await response.arrayBuffer()
        const [{ getDocument, GlobalWorkerOptions }, workerModule] =
          await Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
          ])
        GlobalWorkerOptions.workerSrc = workerModule.default

        const [pdfDocument, fields] = await Promise.all([
          getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise,
          readNativeFields(bytes),
        ])
        loadedPdf = pdfDocument

        if (!cancelled) {
          setSourceBytes(bytes)
          setPdf(pdfDocument)
          setNativeFields(fields)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'The PDF could not be opened.',
          )
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

  useEffect(() => {
    function cancelTool(event: KeyboardEvent) {
      if (event.key === 'Escape') setActiveTool(undefined)
    }

    window.addEventListener('keydown', cancelTool)
    return () => window.removeEventListener('keydown', cancelTool)
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

  async function downloadPdf() {
    if (!sourceBytes) return

    setError('')
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
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The edited PDF could not be created.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#e8e8e2]">
      <header className="sticky top-0 z-50 border-b border-[#302d2d] bg-[#fdfff1] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <a className="flex items-center gap-3 text-[#302d2d]" href="/">
            <span className="grid size-9 place-items-center rounded-[2px] bg-[#302d2d] text-[#fdfff1]">
              <PermitIcon />
            </span>
            <span>
              <span className="block text-[0.6rem] font-medium tracking-[0.2em] uppercase">
                Permit Search
              </span>
              <span className="block font-medium">PDF editor</span>
            </span>
          </a>

          {pdf && (
            <div className="flex flex-wrap items-center gap-2">
              <ToolButton
                active={activeTool === 'text'}
                onClick={() => setActiveTool('text')}
              >
                + Text
              </ToolButton>
              <ToolButton
                active={activeTool === 'check'}
                onClick={() => setActiveTool('check')}
              >
                + Check
              </ToolButton>
              <ToolButton
                active={activeTool === 'date'}
                onClick={() => setActiveTool('date')}
              >
                + Date
              </ToolButton>
              <ToolButton
                active={activeTool === 'signature'}
                onClick={() => setActiveTool('signature')}
              >
                + Signature
              </ToolButton>
              <button
                className="ml-1 rounded-full bg-[#1968b4] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#145390] disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void downloadPdf()}
                type="button"
              >
                {isSaving ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          )}
        </div>
        {activeTool && (
          <p className="mx-auto mt-2 max-w-[1500px] text-center text-xs font-medium text-[#1968b4]">
            Click anywhere on a page to place the {activeTool} field. Press
            Escape to cancel.
          </p>
        )}
      </header>

      {isLoading ? (
        <div className="grid flex-1 place-items-center py-24">
          <p className="flex items-center gap-3 font-medium">
            <span className="size-4 animate-spin rounded-full border-2 border-[#1968b4]/25 border-t-[#1968b4]" />
            Preparing editor…
          </p>
        </div>
      ) : error && !pdf ? (
        <section className="m-auto max-w-lg border border-[#953012] bg-[#fdfff1] p-7 text-center">
          <h1 className="text-2xl font-medium">This PDF could not be opened</h1>
          <p className="mt-3 text-sm leading-6 text-[#302d2d]/70">{error}</p>
          <a
            className="mt-6 inline-flex rounded-full bg-[#1968b4] px-5 py-3 text-sm font-medium text-white"
            href="/"
          >
            Return to search
          </a>
        </section>
      ) : (
        <>
          {error && (
            <p
              className="sticky top-[65px] z-40 border-b border-[#953012] bg-[#fff0eb] px-4 py-3 text-center text-sm text-[#953012]"
              role="alert"
            >
              {error}
            </p>
          )}
          <section
            className={`flex-1 overflow-auto px-4 py-8 ${
              activeTool ? 'cursor-crosshair' : ''
            }`}
          >
            <div className="mx-auto flex w-max min-w-full flex-col items-center gap-7">
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
                  />
                ))}
            </div>
          </section>
        </>
      )}
    </main>
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
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState<PDFPageProxy>()
  const [viewport, setViewport] = useState<PageViewport>()

  useEffect(() => {
    let cancelled = false
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined

    async function renderPage() {
      const loadedPage = await pdf.getPage(pageIndex + 1)
      const pageViewport = loadedPage.getViewport({ scale: 1.35 })
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
  }, [pageIndex, pdf])

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
    <article>
      <p className="mb-2 text-center text-xs font-medium text-[#302d2d]/55">
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
    'absolute border border-[#1968b4]/60 bg-[#e9f4ff]/70 text-[#172635] outline-none focus:border-[#1968b4] focus:ring-2 focus:ring-[#1968b4]/25'

  if (field.kind === 'text') {
    const shared = {
      'data-editor-control': true,
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
        className={`${className} accent-[#1968b4]`}
        data-editor-control
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
        className="absolute grid cursor-pointer place-items-center rounded-full border border-[#1968b4]/60 bg-[#e9f4ff]/70"
        data-editor-control
        style={style}
        title={widget.option}
      >
        <input
          checked={field.value === widget.option}
          className="size-[70%] accent-[#1968b4]"
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
      className="group absolute border border-dashed border-[#953012] bg-white/80"
      data-editor-control
      style={style}
    >
      {field.kind === 'check' ? (
        <button
          aria-label="Toggle checkmark"
          className="grid size-full place-items-center text-lg font-bold text-[#302d2d]"
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
        className="absolute -top-2 -right-2 hidden size-5 place-items-center rounded-full bg-[#953012] text-xs text-white group-hover:grid"
        onClick={onDelete}
        type="button"
      >
        ×
      </button>
    </div>
  )
}

function ToolButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-[#1968b4] bg-[#1968b4] text-white'
          : 'border-[#302d2d]/35 hover:border-[#302d2d]'
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
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

  const regularFont = await document.embedFont(StandardFonts.Helvetica)
  const signatureFont = await document.embedFont(StandardFonts.HelveticaOblique)
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
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
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

function PermitIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        d="M3 21h18M4.5 9h15M6 9v9m4-9v9m4-9v9m4-9v9M3.75 6 12 2.25 20.25 6v3H3.75V6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
