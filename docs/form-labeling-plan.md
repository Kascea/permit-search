# Form labeling plan

Give every fillable box on a form a clear label, once per form, so Autofill can
match boxes to a project's fields in code.

## Status

A design, not built. Autofill today is code-only: it matches field names and
printed labels ([autofill.ts](../src/lib/projects/autofill.ts)). This plan has
not been tested. Do the label test in [Build order](#build-order) before changing
the app.

## The problem

Autofill needs to know what each box asks for. We have two facts about every
box on a digital PDF: its exact position and the page's printed text. What we
don't have is the link between them.

- A field's PDF name is often no help, such as `Text12`.
- The printed text nearest a box can be wrong. `thouse.number_dwelling_units`
  shares a row with "Unit 3", while its real label, "# of dwelling units within
  structure", sits above it.
- A table cell's meaning comes from its row and its column, not from any one
  piece of text.

OCR doesn't solve this. A digital PDF's text can already be read exactly. A
vision model reads scanned pages as part of looking at the page.

## The design

### 1. Label the form once

The first time anyone opens a version of a form:

1. Render each page to an image and draw a small number inside each box. We
   know where the boxes are, so the model doesn't have to find them.
2. Send the marked pages to Gemini Flash with the list of numbers and the
   project fields it can choose from.
3. Get back, per number, a label, the built-in project field it asks for (if
   any) and whether city staff fill it in.
4. Check the answer in code: every number comes back once, and every project
   field is a real one. If a page fails the check, retry it once, then leave
   its boxes unlabeled.

```json
{
  "1": {
    "label": "Unit 1, number of bedrooms",
    "projectField": null,
    "officeUse": false
  },
  "2": {
    "label": "Contractor phone number",
    "projectField": "contractorPhone",
    "officeUse": false
  }
}
```

The model only sees the blank form and the fixed list of built-in fields. It
never sees a project's values or custom field labels.

### 2. Save it with the form

Add the results to each field in the `FormSchema` stored in `form_schemas`, and
bump `FORM_SCHEMA_VERSION`. No new table is needed, and every user of that
version of the form shares the result.

### 3. Fill in code

When the user presses Autofill, with no model call:

| Case | Rule |
|---|---|
| Built-in field | Use the box's saved `projectField` |
| Custom field | Every word of its label is in the box's label, ignoring small words and plurals |
| Fits more than one box | Fill none of them |
| Office use | Skip |
| No match | Leave it empty and report no match |

## Decisions

- **Numbered boxes, not box detection.** Asking a model to find boxes adds a
  source of error for something we already know.
- **No layout-specific code.** The same steps cover tables, contact sections
  and single boxes. Don't add rules for one form's layout.
- **No confirmation step.** Autofill fills what it's sure of and reports the
  rest.
- **Whole pages, not crops.**
- **Once per form.** Choose the model on accuracy, as the cost is one call per
  version of a form and later users of it add nothing.

## What we tried with Jev

We built matching with Jev (TypeSafe) on Autofill and removed it, all on one
Austin form with made-up projects. This is what's worth keeping:

- Jev's Choice of the closest project field was nearly always right.
- Confirming that pick was the weak part. The text beside a box can mislead
  ("Unit 3") or be essential (the unit a cell is for), and each fix for one box
  broke another. Asking with and without the row text gave no wrong fills in 5
  runs, but `number_bedrooms.1` then missed every time.
- A red outline on a full page helped more than any text change: 0.95 for
  dwelling units, up from 0.58–0.65. That small test is why this design marks
  boxes on the page.
- Jev can't write labels, only pick from options, so it can't produce this
  plan's first step. It may still suit matching custom fields, as text with no
  image.

## Model and cost

Gemini Flash is the first choice. Check prices when building, as they change.
Listed prices per 1M tokens, as of November 2026:

| Model | Input | Output |
|---|---|---|
| [Gemini 3.8 Flash, through Dec 31, 2026](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) | $0.75 | $3.75 |
| Gemini 3.8 Flash, from Jan 1, 2027 | $1.50 | $7.50 |
| [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/pricing) | $0.25 | $1.50 |

At an assumed 8k input and 3k output tokens for a 4-page form, 3.8 Flash costs
about 2–4 cents per form. Image token counts are a guess until measured.

The only evidence for Flash on documents is general: Gemini 3 Flash [scored
about 96.9% on one data extraction test](https://playground.roboflow.com/models/compare/gemini-3-flash-vs-qwen3-vl-8b-instruct),
and [one review we couldn't verify](https://intuitionlabs.ai/articles/gemini-3-8-flash-research-tasks-review)
says 3.8 Flash trails on dense documents. Neither tests labeling boxes.

If Flash falls short, try Flash-Lite and Qwen3-VL 235B, an open model.

## Open questions

- **Where pages get rendered.** The schema is shared, so a browser shouldn't
  supply the images behind it. Find out whether the Worker can render pages. If
  it can't, the options are a separate rendering service or labeling outside the
  Worker.
- **When labeling runs.** The editor already reads a form in the background when
  it opens, so labeling fits there, but it may take longer than that request
  should. Measure it.
- **Jev roles.** Check form uses Jev's `role` per field. If `projectField` proves
  reliable it could replace that. Keep roles until then.
- **Custom fields worded differently.** "Number of homes" won't match "dwelling
  units". Add a matching step for custom fields only if this turns out to be
  common.

## Risks

- **A label on the wrong box.** This would put a value in the wrong place, so it
  matters more than a missing label. Test dense pages.
- **Numbers on small boxes.** A number may not fit or may cover printed text.
- **Boxes in odd places.** Boxes that span table rows, like dwelling units here,
  are the kind that fooled Jev.
- **Forms with no fillable boxes.** There's nothing to number. Leave these out
  at first, including boxes users place by hand.
- **A form's saved labels being wrong for everyone.** Results are shared, so log
  each form's labels, and let a bump of `FORM_SCHEMA_VERSION` rebuild them.

## Build order

1. **Test labels from a script, with no app changes.** Use the Austin townhouse
   form plus 3–5 forms from other cities, including one with meaningless field
   names. Check every label against the real box. Needs `GEMINI_API_KEY`.
2. Decide from the results. Stop here if labels on the wrong box are common.
3. Add the fields to `FormSchema`, the labeling step, and the version bump.
4. Switch Autofill's matching to the saved labels, and remove `FIELD_NAMES` and
   the matching on PDF names from `autofill.ts`.
5. Remove Jev's `role` if `projectField` can replace it.
