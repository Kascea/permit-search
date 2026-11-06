import {
  describeField,
  findSignatureLines,
  mergeLines,
  textOverBox,
} from '#/lib/forms/labels'
import type {
  FormFieldKind,
  PageRect,
  SignatureLine,
  TextLine,
} from '#/lib/forms/types'

// A form field as printed, before Jev says what it asks for.
export interface ExtractedField {
  name: string
  kind: FormFieldKind
  // The PDF flags the field as required.
  requiredFlag: boolean
  rect: PageRect
  label: string
  section: string | null
  line: string
  // Printed text just above or over the box, often what names a table's cell.
  textAbove: string
}

export interface ExtractedForm {
  // The largest text on the first page, such as "Fence permit application".
  title: string | null
  fields: Array<ExtractedField>
  signatureLines: Array<SignatureLine>
  lines: Array<TextLine>
}

// Keeps a stored schema small; a long form's later pages are mostly
// instructions.
const MAX_LINES = 4_000

// pdf.js widget flags: hidden and no-view. The editor skips these too.
const HIDDEN_FLAGS = 2 | 32

// The fields of the annotation shape this reads. pdf.js types annotations
// loosely.
interface WidgetAnnotation {
  fieldName?: string
  fieldType?: string
  rect: [number, number, number, number]
  annotationFlags?: number
  readOnly?: boolean
  required?: boolean
  hidden?: boolean
  checkBox?: boolean
  radioButton?: boolean
  pushButton?: boolean
  combo?: boolean
  multiSelect?: boolean
  alternativeText?: string
}

// pdf.js runs its worker in this thread when the worker module is on
// globalThis, as a Worker has no Web Workers.
async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ])

  Object.assign(globalThis, { pdfjsWorker: worker })

  return pdfjs
}

function kindOf(annotation: WidgetAnnotation): FormFieldKind | null {
  switch (annotation.fieldType) {
    case 'Tx':
      return 'text'
    case 'Btn':
      if (annotation.pushButton) return null

      return annotation.radioButton ? 'choice' : 'checkbox'
    case 'Ch':
      return annotation.multiSelect && !annotation.combo ? 'multiple' : 'choice'
    default:
      return null
  }
}

// Reads a blank form's fields and printed text, and names each field from
// the text around it.
export async function extractForm(bytes: ArrayBuffer): Promise<ExtractedForm> {
  const pdfjs = await loadPdfJs()

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  })

  const document = await loadingTask.promise

  try {
    const runs: Array<TextLine> = []
    const widgets: Array<{ annotation: WidgetAnnotation; rect: PageRect }> = []
    const signatureRects: Array<PageRect> = []

    for (let pageIndex = 0; pageIndex < document.numPages; pageIndex++) {
      const page = await document.getPage(pageIndex + 1)

      const [content, annotations] = await Promise.all([
        page.getTextContent(),
        page.getAnnotations(),
      ])

      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue

        runs.push({
          pageIndex,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height || Math.abs(item.transform[3]),
          text: item.str,
        })
      }

      // SAFETY: getAnnotations returns plain objects; only the optional
      // properties above are read, each checked before use.
      for (const annotation of annotations as Array<WidgetAnnotation>) {
        if (!annotation.fieldName || annotation.hidden) continue

        if ((annotation.annotationFlags ?? 0) & HIDDEN_FLAGS) continue

        const [x1, y1, x2, y2] = annotation.rect

        const rect = {
          pageIndex,
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        }

        if (annotation.fieldType === 'Sig') signatureRects.push(rect)
        else if (!annotation.readOnly) widgets.push({ annotation, rect })
      }

      page.cleanup()
    }

    const lines = mergeLines(runs).slice(0, MAX_LINES)
    const fieldRects = widgets.map(({ rect }) => rect)
    const fields: Array<ExtractedField> = []
    const seen = new Set<string>()

    // A radio group has one widget per option; the first names the group.
    for (const { annotation, rect } of widgets) {
      const kind = kindOf(annotation)
      const name = annotation.fieldName

      if (!kind || !name || seen.has(name)) continue
      seen.add(name)

      const described = describeField(
        rect,
        lines,
        fieldRects,
        kind === 'checkbox',
      )

      // A field with nothing printed beside it may still have a tooltip.
      const tooltip = annotation.alternativeText?.trim()

      fields.push({
        name,
        kind,
        requiredFlag: annotation.required === true,
        rect,
        ...described,
        textAbove: textOverBox(rect, lines),
        label:
          described.label ||
          (tooltip && tooltip !== 'undefined' ? tooltip : '') ||
          name.split('.').at(-1) ||
          name,
      })
    }

    const printedSignatures = findSignatureLines(lines)

    // A signature field usually sits on a printed signature line; that line
    // already counts.
    const signatureFields = signatureRects.flatMap((rect) =>
      printedSignatures.some(
        (line) =>
          line.pageIndex === rect.pageIndex &&
          Math.abs(line.y - rect.y) <= rect.height,
      )
        ? []
        : [
            {
              ...rect,
              label:
                describeField(rect, lines, fieldRects, false).label ||
                'Signature',
            },
          ],
    )

    const signatureLines = [...printedSignatures, ...signatureFields]

    return { title: printedTitle(lines), fields, signatureLines, lines }
  } finally {
    await loadingTask.destroy()
  }
}

function printedTitle(lines: Array<TextLine>) {
  const firstPage = lines.filter(
    (line) => line.pageIndex === 0 && line.text.trim().length > 3,
  )

  const tallest = firstPage.sort((a, b) => b.height - a.height || b.y - a.y)[0]

  return tallest ? tallest.text.trim().slice(0, 120) : null
}
