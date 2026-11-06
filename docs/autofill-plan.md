# Autofill plan

Fill a form from a project using code wherever we can, and Jev only to find
the box for a project value that code can't place. Start from the project's
values and look for their boxes, not from every box on the form.

## Status

A proof of concept is built for text fields, in
[autofill.ts](../src/lib/projects/autofill.ts),
[find-boxes.server.ts](../src/lib/forms/find-boxes.server.ts) and the editor. It
has been tested on one form, with limited pages per press and no caching. It
logs each decision for tuning. Text boxes users place aren't filled yet.

## The process

| # | Step | Who does it | Status |
|---|---|---|---|
| 1 | Read the form's fields: name, page, position, type | Code | Built |
| 2 | Check the form has fillable fields, else stop | Code | Built |
| 3 | Read the printed text around each box, and render each page | Code | Built |
| 4 | List the project values that aren't empty | Code | Built |
| 5 | Fill known and exact matches, and take them off both lists | Code | Built |
| 6 | For each value left, find its box on each page | **Jev** | POC |
| 7 | Decide whether to fill, from Jev's answers | Code | POC |
| 8 | Format the value, such as "MN" for a narrow state box | Code | Built |
| 9 | Fill only empty boxes, with Undo | Code | Built |
| 10 | Show what was filled and what had no box, in the panel shared with Check | Code | POC |
| 11 | Let the user review, with Check form for what's missing | Person, Jev | Built |

Only step 6 needs a model. A value with no match stays unfilled and is reported.

### Step 5: code matches

- A box's name or printed label exactly matches a known name for a project
  field. "Total Job Valuation" is a name for estimated cost.
- Every word of a custom field's label is in a box's name or printed label.
- A match that fits more than one box fills none of them, and goes on to step 6.

### Step 6: Jev finds the box

Send one request per page, in batches of about 8 project fields, with the page
image in the state. Each project field gets two questions:

- **Choice:** "Which box on `page` asks for the value saved as `project_field`?"
  The options are that page's remaining boxes, described by PDF name and nearby
  text.
- **Noul:** "Does `page` have a box that asks for the value saved as
  `project_field`?"

Only labels are sent, never the project's values. A Choice always picks a box,
which is why the Noul is needed. A page with one box left only gets the Noul. The
wording is in `forms/questions.ts`.

### Step 7: code decides

| Jev's answers | Action |
|---|---|
| Noul at least 0.7 | Fill the chosen box |
| Noul below 0.7 | No match on this page |
| Two project fields choose the same box | Fill neither |
| Chosen box isn't empty | Leave it alone |
| The Jev call fails | Show an error, never "no match" |

A value can fill boxes on more than one page, as an address printed twice can.

## Why start from project values

Starting from each box asks Jev to weigh every project field for all 92 text
boxes, most of which have no answer. Starting from values asks a small number
of questions that usually do. It's also how Claude filled this form when asked
in the browser: start from what you know, then look for where it goes.

| Test on the Austin townhouse form | Right fields | Wrong fills |
|---|---|---|
| Each box, separate confirmation question | 13–14 of 15 | 0, after several rounds of fixes |
| Each project value, Choice plus Noul | 15–16 of 20 | 0 in all 3 runs |

The second test, with the same page images and made-up labels, is harder. It
includes values only a table's layout can place, like "Unit 4 balcony area" and
"Unit 5 bedrooms", and 6 values the form has no box for, all correctly left
unfilled. The Choice found the right box for all 20 values in the run checked.

The misses are the Noul being too cautious, and were the same boxes each run:

| Value | Noul | Caught by |
|---|---|---|
| Estimated cost of the work | 0.32–0.35 | Code, as a known name |
| Contractor company name | 0.14–0.19 | Code, as a known name |
| Number of dwellings | 0.52–0.62 | Code, as matching words |
| Number of homes | 0.40–0.42 | Nothing yet |
| Site plan number | 0.69 in one run | Nothing yet |

Run together, code and Jev should get 18–19 of 20. That's worked out from these
results, not run. One run cost about $0.009 for 26 fields, and leaving out what
code already filled will lower it.

## Where an LLM would still help

We don't need an LLM for the process above. Add one only if testing shows a need.

| Need | What to use |
|---|---|
| Forms with meaningless field names, if Jev fails on them | Have an LLM label each box once per form, and save the labels |
| Forms with no fillable boxes | A box detector such as [CommonForms](https://news.ycombinator.com/item?id=47947347), which isn't an LLM |
| Free-form values, such as "8'6" into feet and inches | Code first; an LLM only if it's common |
| Instructions typed by the user | An LLM, but this is a different feature |

For labeling, number each box on the page image, ask for a label per number, and
check in code that every number came back once. Save results per form in
`form_schemas`. Try Gemini Flash and Claude.

## Decisions

- **Code before models.** Every step that can be code is code.
- **Jev finds, code decides.** Jev never chooses whether to fill.
- **No confirmation step.** Autofill fills what it's sure of and reports the rest.
- **No rules for one form's layout,** such as table detection.
- **Whole pages, not crops.**

## Open questions

- **When step 6 runs.** Start on the Autofill press, as it's simplest, and
  measure how long it takes. If it's slow, run it when a form opens with a project.
- **Caching.** Answers depend only on the form and the label, so they could be
  saved by `source_hash` and label. Add this if cost or speed calls for it.
- **Checkboxes and radio buttons.** Autofill only fills text today. Jev could
  answer Yes/No questions like "Is the property in the airport overlay?", but
  the project would have to hold those answers.
- **Field names.** The test's options include PDF names, and this form's are
  descriptive. Whether Jev copes without them is the biggest unknown.

## Risks

- **One form.** All these results come from one Austin form and made-up labels.
- **Text boxes users place.** They have no PDF name, so expect more misses.
- **Noul scores vary by box.** 0.7 may be wrong for other forms. Don't fit it to
  a few cases.
- **Image support.** Jev's images need a "danger zone" header, and its docs warn
  they may change.

## Next steps

1. Try the POC on real projects, using the `autofill value` logs to see each
   decision.
2. Test it on 3–5 forms from other cities, including one with meaningless names.
   A wrong value on a permit costs more than a blank one, so treat wrong fills as
   the thing to fix first.
3. If meaningless names fail, try the LLM labeling above for those forms.
4. Remove the detailed logs, and grow the list of known names from what users'
   forms show.
