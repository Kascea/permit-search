import { PDFName } from 'pdf-lib'
import type { PDFCheckBox } from 'pdf-lib'

// Some forms build a Yes/No question as one checkbox field with a box per
// answer, each with its own "on" value, instead of a radio group. Only one can
// be on, so it behaves like a radio group, though pdf-lib reads it as a checkbox.

function onValuesOf(field: PDFCheckBox) {
  return field.acroField
    .getWidgets()
    .map((widget) => widget.getOnValue()?.decodeText() ?? '')
}

// The field's answers, one per box, when it's this kind of field. Otherwise null,
// such as for a plain checkbox, or one shown in two places with one value.
export function exclusiveOptions(field: PDFCheckBox) {
  const values = onValuesOf(field)

  return values.length > 1 &&
    values.every(Boolean) &&
    new Set(values).size === values.length
    ? values
    : null
}

// The answer that's on, or '' when none is.
export function selectedOption(field: PDFCheckBox) {
  const off = PDFName.of('Off')

  const selected = field.acroField.getWidgets().find((widget) => {
    const state = widget.getAppearanceState()

    return state !== undefined && state !== off
  })

  return selected?.getOnValue()?.decodeText() ?? ''
}

// Turns on the box for one answer and the others off, or all off for ''.
export function selectOption(field: PDFCheckBox, option: string) {
  const off = PDFName.of('Off')
  let value = off

  for (const widget of field.acroField.getWidgets()) {
    const onValue = widget.getOnValue()

    if (onValue && onValue.decodeText() === option) {
      widget.setAppearanceState(onValue)
      value = onValue
    } else {
      widget.setAppearanceState(off)
    }
  }

  field.acroField.dict.set(PDFName.of('V'), value)
}
