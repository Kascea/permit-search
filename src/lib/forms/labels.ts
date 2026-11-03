import type { PageRect, SignatureLine, TextLine } from '#/lib/forms/types'

// Reads the printed text around a form field: the label that names it, the
// line it's on, and the heading it sits under. pdf.js gives text as runs with
// a position and width, and a form's blanks are printed as underscores, so
// "City: ____ State: ____" is one run with two fields on it.

const FIELD_MARK = '[this field]'
const BOX_MARK = '[this box]'
const CHECKBOX_GLYPHS = /[☐☑☒□■]/
const MAX_LABEL_LENGTH = 120
const MAX_SECTION_LENGTH = 70

// Joins runs on the same baseline that sit close together, so a heading or a
// label split by a font change reads as one line.
export function mergeLines(runs: Array<TextLine>): Array<TextLine> {
  const sorted = runs
    .filter((run) => run.text.trim())
    .sort((a, b) => a.pageIndex - b.pageIndex || b.y - a.y || a.x - b.x)

  const merged: Array<TextLine> = []

  for (const run of sorted) {
    const last = merged.at(-1)

    const gap = last ? run.x - (last.x + last.width) : Infinity

    if (
      last &&
      last.pageIndex === run.pageIndex &&
      Math.abs(last.y - run.y) <= 1.5 &&
      gap > -2 &&
      gap <= Math.max(last.height, run.height) * 1.5
    ) {
      last.text +=
        gap > 1 && !last.text.endsWith(' ') ? ` ${run.text}` : run.text
      last.width = run.x + run.width - last.x
      last.height = Math.max(last.height, run.height)
    } else {
      merged.push({ ...run })
    }
  }

  return merged
}

// Whether a line of text shares a row with a box. Text runs are measured from
// their baseline, so they reach a little below it.
function onSameRow(line: TextLine, rect: PageRect) {
  if (line.pageIndex !== rect.pageIndex) return false

  const top = Math.min(line.y + line.height, rect.y + rect.height)
  const bottom = Math.max(line.y - line.height * 0.25, rect.y)

  return top - bottom >= Math.min(line.height, rect.height) * 0.4
}

// How many characters of a line come before x, assuming even spacing.
function charsBefore(line: TextLine, x: number) {
  if (line.width <= 0) return 0

  const share = (x - line.x) / line.width

  return Math.round(Math.min(Math.max(share, 0), 1) * line.text.length)
}

// Where a field starts within a line: the blank nearest the even-spacing
// estimate, as underscores and letters differ in width.
function blankStart(line: TextLine, x: number) {
  const estimate = charsBefore(line, x)
  const tolerance = Math.max(8, line.text.length * 0.2)
  let best: number | undefined

  for (const match of line.text.matchAll(/_{2,}/g)) {
    const start = match.index

    if (
      Math.abs(start - estimate) <= tolerance &&
      (best === undefined ||
        Math.abs(start - estimate) < Math.abs(best - estimate))
    ) {
      best = start
    }
  }

  return best ?? estimate
}

function rowOf(rect: PageRect, lines: Array<TextLine>) {
  return lines.filter((line) => onSameRow(line, rect)).sort((a, b) => a.x - b.x)
}

function tidy(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

// "Name: ____ Email: ____" → "Name: [this field] Email: ___", with the mark
// where the box is.
export function markedLine(
  rect: PageRect,
  lines: Array<TextLine>,
  mark: string,
) {
  const parts: Array<string> = []
  let placed = false

  for (const line of rowOf(rect, lines)) {
    if (!placed && rect.x < line.x) {
      parts.push(mark)
      placed = true
    }

    if (!placed && rect.x < line.x + line.width) {
      const at = blankStart(line, rect.x)
      parts.push(`${line.text.slice(0, at)} ${mark} ${line.text.slice(at)}`)
      placed = true
    } else {
      parts.push(line.text)
    }
  }

  if (!placed) parts.push(mark)

  const escaped = mark.replace(/[[\]]/g, '\\$&')

  return tidy(
    parts
      .join(' ')
      // The blank the field covers is the field.
      .replace(new RegExp(`_+\\s*${escaped}\\s*_*`), mark)
      .replace(new RegExp(`${escaped}\\s*_+`), mark)
      .replace(/_{2,}/g, '___'),
  ).slice(0, 300)
}

// The text a field's label is cut from: what's printed before it on its row.
function textBefore(rect: PageRect, lines: Array<TextLine>) {
  return rowOf(rect, lines)
    .filter((line) => line.x < rect.x)
    .map((line) => line.text.slice(0, blankStart(line, rect.x)))
    .join(' ')
}

// The last label before the field, such as "State" from "City: ____ State:".
function labelFrom(text: string) {
  const segments = text
    .split(/_{2,}|[☐☑☒□■]/)
    .map((segment) => tidy(segment).replace(/^[\s_]+|[\s_:$#*]+$/g, ''))
    .filter(Boolean)

  return segments.at(-1) ?? ''
}

// A line printed just above a box, for boxes with no label beside them, such
// as a large "Description of work" box under its heading.
function textAbove(rect: PageRect, lines: Array<TextLine>) {
  const top = rect.y + rect.height

  return lines
    .filter(
      (line) =>
        line.pageIndex === rect.pageIndex &&
        line.y >= top - 2 &&
        line.y - top <= 18 &&
        line.x < rect.x + rect.width &&
        line.x + line.width > rect.x,
    )
    .sort((a, b) => a.y - b.y)
    .at(0)?.text
}

// The label printed beside a field. Text fields are labeled on their left
// ("Phone: ____"); checkboxes on their right ("☐ Furnace").
export function fieldLabel(
  rect: PageRect,
  lines: Array<TextLine>,
  isCheckbox: boolean,
) {
  if (isCheckbox) {
    const after = rowOf(rect, lines)
      .filter((line) => line.x + line.width > rect.x + rect.width)
      .map((line) =>
        line.text.slice(charsBefore(line, rect.x + rect.width - 1)),
      )
      .join(' ')

    const label = tidy(
      after.replace(/^[\s☐☑☒□■]+/, '').split(/_{2,}|[☐☑☒□■]/)[0] ?? '',
    ).replace(/[\s:]+$/, '')

    if (label) return label.slice(0, MAX_LABEL_LENGTH)
  }

  const before = labelFrom(textBefore(rect, lines))

  if (before) return before.slice(0, MAX_LABEL_LENGTH)

  return labelFrom(textAbove(rect, lines) ?? '').slice(0, MAX_LABEL_LENGTH)
}

// Whether a line could be a heading: short text with no blanks or boxes,
// on a row with no fields.
function isHeadingCandidate(line: TextLine, fieldRects: Array<PageRect>) {
  const text = line.text.trim()

  return (
    text.length >= 2 &&
    text.length <= MAX_SECTION_LENGTH &&
    !text.includes('_') &&
    !CHECKBOX_GLYPHS.test(text) &&
    !/^[•·▪\-–]/.test(text) &&
    !fieldRects.some((rect) => onSameRow(line, rect))
  )
}

// The heading nearest above a field, preferring one over the same column.
// span: the field's box widened to its label, for checkboxes whose label is
// beside them.
export function fieldSection(
  rect: PageRect,
  span: { left: number; right: number },
  lines: Array<TextLine>,
  fieldRects: Array<PageRect>,
) {
  const top = rect.y + rect.height
  let best: { text: string; score: number } | undefined

  for (const line of lines) {
    if (
      line.pageIndex !== rect.pageIndex ||
      line.y < top - 1 ||
      onSameRow(line, rect) ||
      !isHeadingCandidate(line, fieldRects)
    ) {
      continue
    }

    // Distance above, plus a quarter of the distance across, so a heading
    // over another column loses to a farther one over this column.
    const score =
      line.y -
      top +
      Math.max(0, line.x - span.right, span.left - (line.x + line.width)) * 0.25

    if (!best || score < best.score) best = { text: tidy(line.text), score }
  }

  return best ? best.text.replace(/:$/, '') : null
}

// The right edge of a checkbox's label, so its section can be matched by
// column.
export function labelSpan(
  rect: PageRect,
  lines: Array<TextLine>,
  isCheckbox: boolean,
) {
  if (!isCheckbox) return { left: rect.x, right: rect.x + rect.width }

  const next = rowOf(rect, lines).find(
    (line) => line.x + line.width > rect.x + rect.width,
  )

  return {
    left: rect.x,
    right: Math.max(
      rect.x + rect.width,
      (next?.x ?? 0) + Math.min(next?.width ?? 0, 150),
    ),
  }
}

// Printed lines that ask for a signature, such as "Applicant signature: ___".
export function findSignatureLines(lines: Array<TextLine>) {
  return lines.flatMap<SignatureLine>((line) => {
    const match = /^(.*?\bsignature\b[^_]*?)\s*_{3,}/i.exec(line.text)

    if (!match) return []

    return [
      {
        pageIndex: line.pageIndex,
        x: line.x,
        y: line.y,
        width: line.width,
        height: line.height,
        label: labelFrom(match[1]) || 'Signature',
      },
    ]
  })
}

export function describeField(
  rect: PageRect,
  lines: Array<TextLine>,
  fieldRects: Array<PageRect>,
  isCheckbox: boolean,
) {
  return {
    label: fieldLabel(rect, lines, isCheckbox),
    line: markedLine(rect, lines, isCheckbox ? BOX_MARK : FIELD_MARK),
    section: fieldSection(
      rect,
      labelSpan(rect, lines, isCheckbox),
      lines,
      fieldRects,
    ),
  }
}
