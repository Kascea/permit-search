# Permit Search design

Permit Search should feel like a drafting sheet: cream paper, a faint grid,
dark ink lines, and one blueprint blue. Keep it plain. When in doubt, use a
ruled line instead of a box, and leave space empty instead of decorating it.

The tokens below live in `src/styles.css`. Use the token names in Tailwind
classes (`text-ink`, `bg-paper`, `border-blueprint`), never raw hex values.

## Principles

- **Paper first.** Every page sits on the cream sheet with its 32px grid. A
  section can tint the paper so text reads clearly, but it should still let the
  grid show through.
- **Lines, not cards.** Group content with full-strength ink rules (`border-ink`)
  above and below. Use light rules (`border-ink/20`) between items inside a
  group. Avoid floating cards and rounded panels. Only the modal casts a
  shadow, because it really does sit above the page.
- **One accent.** Blueprint blue marks what you can act on and the small labels
  above headings. Redline is only for errors and warnings.
- **Flat and quiet.** No gradients, no glows, no white surfaces, and no colors
  outside the palette.

## Palette

| Token            | Value     | Use                                                      |
| ---------------- | --------- | -------------------------------------------------------- |
| `paper`          | `#fdfff1` | Page background, headers, text on blue                   |
| `ink`            | `#302d2d` | Text, rules, field borders                               |
| `blueprint`      | `#1968b4` | Primary buttons, links, small labels, focus, selection   |
| `blueprint-deep` | `#145390` | Hover state for blueprint fills                          |
| `redline`        | `#953012` | Errors, destructive actions, the PDF badge               |

Make softer shades with opacity instead of new colors:

- Ink: `/70` for secondary text, `/60` for metadata, `/40` for icons and
  placeholders, `/20` for light rules, `/10` for hover fills.
- Blueprint and redline: `/10` for badge and alert backgrounds.

The PDF editor is the one exception. Its workspace uses a grey desk
(`#e8e8e2`) and white PDF pages, so the document reads as a real sheet of
paper set on the desk.

## The sheet

- The grid is drawn on `body` in `styles.css`: 1px lines in ink at 4% opacity,
  every 32px. Don't add it again on individual pages.
- A content section that needs to be easier to read uses `bg-paper/50`. That
  keeps the grid faintly visible. Close it with a single ink rule below; don't
  stack a second rule directly under the header.
- Widths: `max-w-[780px]` for a single column such as the home form, and
  `max-w-[1120px]` for the full page with the results and their sidebar. Side
  padding is `px-4 sm:px-6`.

## Type

The font is Arial/Helvetica (`font-sans`). Use `font-medium` for anything with
emphasis, and avoid bold.

| Role           | Classes                                                         |
| -------------- | --------------------------------------------------------------- |
| Display        | `text-[clamp(3rem,9vw,5.75rem)] leading-[0.92] tracking-[-0.055em]` |
| Page heading   | `text-xl sm:text-2xl leading-tight tracking-[-0.02em]`           |
| Item heading   | `text-lg leading-6`                                             |
| Body           | `text-sm leading-6 text-ink/70`                                 |
| Small label    | `text-xs tracking-[0.16em] uppercase text-blueprint`            |
| Meta           | `text-sm text-ink/60`                                           |

Put a small label above a page heading, the way a drawing sheet's title block
names the sheet ("Permit sources", "City permit office").

## Shape

- **Fields and panels:** square, with a 2px radius at most (`rounded-[2px]`).
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
uppercase`, tinted to match the text: `bg-blueprint/10 text-blueprint` for
"Government", and `bg-redline/10 text-redline` for "PDF".

**Result card.** The whole card opens the source: the title link stretches
over it (`after:absolute after:inset-0`), the card gets a faint
`bg-ink/[0.04]` on hover, and the corner arrow turns blue. A second
destination, such as the editor for PDFs, gets its own labeled link under the
description (an icon in a tinted circle plus a short label), raised above the
card link with `relative z-10`. Don't put two look-alike icons side by side
that go to different places.

**Alert.** `border border-redline bg-redline/10 text-redline text-sm
font-medium`.

**Spinner.** Use the `.spinner` class and set its size (`size-3`, `size-4`).
Show one only while the user is waiting on something they asked for. For data
that's nice to have, such as the city contact card, show nothing until it
arrives.

**Header.** `SiteHeader`, on every page except home and the editor. A sticky
56px bar on `bg-paper` with a strong `border-b border-ink`, its contents as
wide as the page content. On the left: the logo, a short light divider, then the page links
(add links to `NAV_LINKS`; the current page's link is blueprint). On the right
of every page, a round search pill with a pin and a blue search button shows
the current city (or "Search for a permit") and opens the search modal, which
`SiteHeader` owns.

**Modal.** Use `Modal` from `src/components/Modal.tsx`: a native `<dialog>`,
centered over a `bg-ink/40` backdrop with a light blur. Each modal sets its own
width (`widthClass`): 640px for the search form, 440px for a short message.
It fades and rises in over 180ms. Draw the panel with `modalPanelClass`, and
put a header row with the title on the left and `ModalCloseButton` on the
right.

**Footer.** `SiteFooter` on every page except the editor: one small line under
a light rule, with the copyright and disclaimer on the left and "About" and
"Contact us" on the right. The contact address lives in `src/lib/site.ts`.

**One way to do each thing.** Don't add a second link or button for an action
the page already offers. Reporting incorrect results, for example, lives only
in the line under the results.

## Motion

Keep motion short (150–180ms, ease-out), and only for changes in state: hover,
focus, a modal opening. Every animation must stop under
`prefers-reduced-motion`.
