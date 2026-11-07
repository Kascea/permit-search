# Permit Search design

Permit Search should feel like a drafting sheet: cream paper, a faint grid,
dark ink lines, and one blueprint blue. Keep it plain. When in doubt, use a
ruled line instead of a box, and leave space empty instead of decorating it.

The tokens below live in `src/styles.css`. Use the token names in Tailwind
classes (`text-ink`, `bg-paper`, `border-blueprint`), never raw hex values.

## Principles

- **Paper first.** Every page sits on the cream sheet with its 2rem grid. A
  section can tint the paper so text reads clearly, but it should still let the
  grid show through.
- **Lines, not cards.** Group content with full-strength ink rules (`border-ink`)
  above and below. Use light rules (`border-ink/20`) between items inside a
  group. Avoid floating cards and rounded panels. Only the modal casts a
  shadow, because it really does sit above the page.
- **One accent.** Blueprint blue marks what you can act on and the small labels
  above headings. Its one large surface is the footer. Redline is only for
  errors and warnings.
- **Flat and quiet.** No gradients, no glows, no white surfaces, and no colors
  outside the palette.

The palette is taken from The American Housing Corporation's site
(americanhousing.com), so keep the two aligned.

## Palette

| Token            | Value     | Use                                                       |
| ---------------- | --------- | --------------------------------------------------------- |
| `paper`          | `#fdfff1` | Page background, headers, text on blue                    |
| `ink`            | `#302d2d` | Text, rules, field borders                                |
| `blueprint`      | `#1968b4` | Primary buttons, links, small labels, focus, selection    |
| `blueprint-deep` | `#145390` | Hover state for blueprint fills                           |
| `redline`        | `#953012` | Errors, destructive actions, the PDF badge                |
| `blueprint-pale` | `#d1e1f0` | Rules, outlines and hover tints on a blue surface         |
| `coral`          | `#ff8a7a` | Error text on a blue surface, where redline can't be read |
| `success`        | `#2e7d32` | Success: the "Saved." chip, a fully filled form           |

Use `success` like the other accents: `bg-success/10 text-success` for a
chip, solid only for small marks such as a progress bar. Don't use a bright
lime green; it fights the paper.

Make softer shades with opacity instead of new colors:

- Ink: `/70` for secondary text, `/60` for metadata, `/40` for icons and
  placeholders, `/20` for light rules, `/10` for hover fills.
- Blueprint and redline: `/10` for badge and alert backgrounds.

The PDF editor's desk (`bg-desk`) is the same grid a shade darker, like a
drafting table, so its white PDF pages read as real sheets laid on it.

## The sheet

- The grid is drawn on `body` in `styles.css` (`--sheet`): ink at 4% opacity,
  one cell every `--grid` (2rem, so it grows with the reader's text size).
  Each line is in the last pixel of its cell. Don't add it again on a page;
  an opaque surface that needs it, such as a sticky header, uses `bg-sheet`.
- Size layout in rem or Tailwind's spacing scale, never in pixels, so pages
  scale with the reader's settings. Hairlines (1px borders and rules) are
  the exception.
- Structural rules that must sit on the grid (the sidebar's edge, the top
  bar's foot) use `rule-r` and `rule-b`: an ink hairline in the box's last
  pixel that takes no space. A box sized in whole cells then has its rule on
  a grid line, with no 1px adjustments.
- A content section that needs to be easier to read uses `bg-paper/50`. That
  keeps the grid faintly visible. Close it with a single ink rule below; don't
  stack a second rule directly under the header.
- Widths: `max-w-3xl` (24 cells) for a single column, and `max-w-280` (35
  cells) for the full page with the results and their sidebar. Beside the
  app sidebar, `AppPage` places them with `sheet-column` and
  `sheet-column-wide`, which center them with the offset rounded to whole
  cells. Side padding is `px-4 sm:px-6`.

## Type

The font is Schibsted Grotesk (`font-sans`), weights 400 and 500, loaded from
Google Fonts in `__root.tsx`. It stands in for Die Grotesk, the paid face on
americanhousing.com. Use `font-medium` for anything with emphasis, and avoid
bold.

| Role         | Classes                                                        |
| ------------ | -------------------------------------------------------------- |
| Display      | `text-[clamp(3rem,9vw,5.5rem)] leading-[1] tracking-[-0.04em]` |
| Page heading | `text-[1.75rem] sm:text-4xl leading-[1.05] tracking-[-0.03em]` |
| Item heading | `text-lg leading-6`                                            |
| Body         | `text-base leading-6 text-ink/70`                              |
| Small label  | `text-xs tracking-[0.16em] uppercase text-blueprint`           |
| Meta         | `text-sm text-ink/60`                                          |

Put a small label above a page heading, the way a drawing sheet's title block
names the sheet ("Permit sources", "City permit office").

## Shape

- **Fields and panels:** square, with a 2px radius at most (`rounded-xs`).
- **Buttons, chips and badges:** fully round (`rounded-full`). That's the one
  soft shape on the sheet, and it shows what can be clicked.
- **Borders:** always 1px.

## Components

**Primary button.**
`rounded-full bg-blueprint text-paper hover:bg-blueprint-deep`, with a
blueprint focus outline (`focus-visible:outline-2 outline-offset-2`). Use at
most one per view.

**Secondary chip** (such as "Detect my city"). `rounded-full border
border-ink/40 text-xs`. On hover it inverts to `bg-ink text-paper`.

**Text field.** Use the `.field-input` class: a 1px ink border on a clear
background, so the paper shows through. On focus the border turns blueprint
with a soft blueprint ring.

**Badge.** `rounded-full px-2 py-0.5 text-[0.65rem] tracking-[0.08em]
uppercase`, tinted to match the text: `bg-redline/10 text-redline` for "PDF".
A government source gets a round check icon in `text-blueprint/75` beside its
domain instead of a text badge, titled "Official government website".

**Result card.** Only the title opens the source, with a small ↗ arrow after
it; the rest of the card isn't a link, so its actions can't be mistaken for
part of one. PDFs get one row of actions under the description, in order of
weight: "Fill out form" as an outlined row button (`rowPrimaryButtonClass`),
then "Save permit" and "Add to project" as quiet actions
(`quietActionClass`), then "Saved in" as plain text. Both classes live in
`components/buttons.ts`.

A state agency's page ("State of Minnesota" badge, `bg-blueprint/10
text-blueprint`) comes after the city's results, at most three, with a line
under its description saying some cities run the permit themselves.

**Alert.** Use `<Notice tone="error">` (see Feedback below), not hand-written
classes.

## Feedback

Success and errors look the same everywhere, inline or in a toast:

| Tone    | Classes (`toneClass` in `Notice.tsx`)         | Icon                         |
| ------- | --------------------------------------------- | ---------------------------- |
| Success | `border-success bg-success-wash text-success` | Check in a circle            |
| Error   | `border-redline bg-redline-wash text-redline` | Exclamation mark in a circle |

The `-wash` tokens are paper tinted 10% toward the color, solid so a toast
reads over whatever is under it.

- **Inline** (`<Notice tone>`): a result tied to a form or action on screen,
  such as a failed save. Put it right beside that form's button.
- **Toast** (`toast.success()` / `toast.error()` from `sonner`): a result of
  an action that isn't tied to a form, or that moves you elsewhere, such as
  "Project saved." or "Draft deleted.". Keep it to one short sentence ending
  in a period. Offer Undo as the toast's action when the change can be put
  back.
- **Every action the user starts ends in visible feedback, even when
  nothing changed.** A click that only updates a date, or does nothing at
  all, reads as broken. Say what happened: "No change: permit SL306008 is
  still Finaled.", "Stopped tracking permit SL306008.", or the error.
  - Have the server return what the action did (changed, unchanged, reused
    a recent result, failed), not just the new data, so the toast can say
    so. See `PermitCheckResult` and `checkToast()` in `src/lib/tracking/`.
  - A failure the page also shows inline, such as a permit's check error,
    still gets an error toast when the user caused it, so they see it
    without searching.
  - Background work the user didn't start, such as autosave, needs no
    toast. Show its state quietly where it lives, like the draft status
    label.
- A single field's problem, such as "Choose a city from the list", stays as
  small `text-redline` text under the field.
- Primary and quiet buttons come from `components/buttons.ts`, so the same
  action (Save, Cancel) looks the same in every place it appears.

**Spinner.** Use the `.spinner` class and set its size (`size-3`, `size-4`).
Show one only while the user is waiting on something they asked for. For data
that's nice to have, such as the city contact card, show nothing until it
arrives.

**App frame.** `AppSidebar` sits beside every page from lg up, signed in or not
(`useHasAppSidebar`), so signing in fills it in rather than moving anything. The
exceptions are the editor and the signed-out home page, which stands alone with
no header or sidebar. Visitors see the same rows, with a lock on the ones that
need an account, and "Sign in" where the account row sits.

**Sign-in gates.** An account-only page shows `<SignInGate>` with one line on
what the page is for. An account-only action stays visible and is a
`SignInButton` with a `reason` and a `resume`, so sign-in says why it's asking
and finishes the action. The server enforces every gate; these only explain it.

**Header.** `SiteHeader`, on every page except the editor and the signed-out
home page. A sticky 56px bar on
`bg-paper` with a strong `border-b border-ink`, its contents as wide as the page
content. On the left, below lg: the logo. On the right, a round search pill
with a pin and a blue search button shows the current city (or "Search for a
permit") and opens the search modal, which `SiteHeader` owns. Below lg, the
account menu holds the page links, for visitors too.

**Editor tool row.** In the PDF editor, the field tools, zoom and pages sit on
plain paper in `border-ink/30` groups. Only the field tool icons are
blueprint, and the selected tool fills solid blueprint. Don't tint the row.

**Modal.** Use `Modal` from `src/components/Modal.tsx`: a native `<dialog>`,
centered over a `bg-ink/40` backdrop with a light blur. Each modal sets its own
width (`widthClass`): 640px for the search form, 440px for a short message.
It fades and rises in over 180ms. Draw the panel with `modalPanelClass`, and
put a header row with the title on the left and `ModalCloseButton` on the
right.

**Footer.** `SiteFooter` on every page except the editor, and below lg wherever
`AppSidebar` is: a slim
`bg-blueprint` strip, one line of `text-xs` paper text. On the left, a small
logo with the copyright and disclaimer (`text-paper/70`). On the right,
"About" and "Contact us" in `font-medium`, fading on hover. Keep it compact so
the blue stays an accent. The contact address lives in `src/lib/site.ts`.

**One way to do each thing.** Don't add a second link or button for an action
the page already offers. Reporting incorrect results, for example, lives only
in the line under the results.

## Motion

Keep motion short (150–180ms, ease-out), and only for changes in state: hover,
focus, a modal opening. Every animation must stop under
`prefers-reduced-motion`.
