---
title: "Preview and the in-place canvas now share their rhythm values, instead of each authoring their own copy"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Closing the drift between two independently-authored implementations

A request arrived (via Sympose, but framed here as a general library concern — see the note on that below) arguing that `preview` and the in-place canvas are "two independently-authored style implementations that happen to agree sometimes," and that patching each newly-discovered gap from outside is whack-a-mole: nothing stops a new one appearing, because nothing ever required the two to produce the same output in the first place.

## Verifying the claims first

Five concrete divergences were listed as "confirmed from stylo's own source." Each was independently re-checked against the actual code before any of this was touched, the same discipline that caught the earlier `preview-full-parity-with-in-place` request's wrong premise:

- **h5/h6 heading size** — confirmed. `stylo.module.css`'s `.preview :is(h4, h5, h6)` rule set `margin`/`line-height` but never `font-size`; h5/h6 silently fell back to the browser's UA default instead of matching the in-place canvas's `0.9em`.
- **List-item spacing** — confirmed structural. Preview's `<li>` carries a real margin; the in-place canvas, a flat text surface, had no equivalent concept at all.
- **Callout padding/radius** — confirmed. Preview: `padding: 0.6em 1em`, all four corners rounded. In-place: `paddingTop`/`paddingBottom: 0.7em`, only the right corners rounded (built from stacked lines with a `border-left` accent, so the left corner has no box to round).
- **Table width** — did **not** check out. The request claimed in-place forces `width: 100%` and preview doesn't. No such rule exists anywhere in the in-place theme files; a live Playwright measurement confirmed the in-place table renders shrink-to-fit (180px inside a 718px-wide editor), identical to preview. Both surfaces already agree here — no fix applied, and the claim is noted as inaccurate rather than acted on.
- **Vertical rhythm before a block** — confirmed, and flagged by the request itself as the one gap no host-side CSS can close: preview uses a fixed `margin-top` per construct; the in-place canvas uses a smaller `paddingTop`, sized on the assumption that a blank source line usually supplies the rest of the gap. When that assumption doesn't hold — a heading with no blank line before it — the in-place gap collapses to just the padding while preview's stays fixed. Left open; see below.

## What shipped

The request explicitly argued _against_ growing the public token surface as the fix — "more surface to override doesn't fix two independently-authored implementations, it just gives hosts a bigger version of the same whack-a-mole" — and asked instead for one shared values source inside stylo. That's what this ships: six new **internal** custom properties in `tokens.css` (`--stylo-rhythm-h1-size` … `-h6-line`, `--stylo-rhythm-list-item-gap[-nested]`, `--stylo-rhythm-callout-padding-x`/ `-y`), read by both `inplace/theme-canvas.ts` / `theme-callout.ts` and `stylo.module.css` instead of each hard-coding its own number.

Deliberately **not** added to the public "Styling tokens" table in `props.md` — ADR-002 has a standing rule against growing that surface without a real host-facing role ("one token per real role, no shadcn-style sprawl"), and this fix is about internal sharing, not giving hosts a new override point. A host restyling rhythm still targets the resulting CSS classes directly, exactly as before.

Concretely:

- `preview`'s `h4`/`h5`/`h6` each get an explicit `font-size` now (previously only `h1`–`h3` did); `h1`–`h6` and the in-place canvas's `.cm-inplace-h1`– `h6` read the same six size/line-height tokens.
- `preview`'s `.stylo-callout` padding and corner-rounding now match in-place's: `0.7em` vertical (was `0.6em`), and only the right corners round (was all four) — matching in-place's shape rather than in-place growing a fourth rounded corner it structurally can't draw.
- The in-place canvas gains list-item spacing for the first time: `list-guides.ts`'s existing per-`ListItem` walk (previously only for nesting indent guides) now also gives every item but the first in its own list a `cm-inplace-item-gap` line class (`paddingTop`, from the shared token) — the first item of a _nested_ list gets the larger `cm-inplace-item-gap-nested` instead, approximating preview's `li > :is(ul, ol)` margin on the sublist as a whole. This is a translation of preview's box-margin behaviour onto a flat-line canvas, not a bit-for-bit copy of its mechanics — a nested item's own gap in preview comes from CSS margin collapsing between boxes that don't exist here.

## A naming collision, caught by the existing test suite

The first attempt named the new classes `cm-inplace-li-gap` / `cm-inplace-li-gap-nested`. `test/inplace.test.tsx`'s `hasClass` helper does a substring match, and `"cm-inplace-li-gap".includes("cm-inplace-li")` is true — the existing "a flat list gets no `cm-inplace-li` decoration" test failed the moment the new classes existed, because it was actually seeing the new gap class, not the indent-guide one. Renamed to `cm-inplace-item-gap` (no `cm-inplace-li` substring at all) rather than fixing the shared test helper — the substring-match convention already relies on prefix disambiguation elsewhere in the codebase (`cm-inplace-table` / `cm-inplace-table-edit`), so a new name avoiding the collision is the narrower fix.

## Verification

- `npm run format`, `npm run typecheck`, `npm run check:theme`, `npm run build`, `npm run check:size`, `npm run check:package` — clean. `InPlaceView` stayed at 22,111 B gzip, unchanged against its 23,000 B budget.
- `npm run test` — 461 passing, including a new case asserting the exact gap-class pattern across a flat item, a nested-list's first item, and a nested-list's second item.
- Two new permanent Playwright specs (`test/browser/rhythm.spec.ts`) load the in-place canvas and (via `split` mode's live-updating preview pane) preview with the same pasted document, and assert their **computed** values match — not hard-coded numbers, so either surface drifting from the other fails the test regardless of which side moved. Heading sizes h1–h6 and callout padding/corner-radius are covered this way; both passed post-fix, confirming the fix does what was intended in a real browser, not just in the CSS source.
- The same live-Chromium technique (paste via clipboard into `mode=in-place` and separately into `mode=split`'s source pane, then read `getComputedStyle`) was used ad hoc first to confirm every numeric claim above, including disproving the table-width one, before any code changed.

## What's still open

The vertical-rhythm-before-a-block gap is unresolved. The request's own framing is correct: no shared token fixes it, because the in-place canvas's current gap is a function of how many blank lines the document happens to contain, and preview's isn't. Closing it means collapsing blank-line runs into a fixed decorative gap (matching preview's margin) with the underlying blank lines revealed at normal height only while the caret is near them — the same reveal-on-caret-entry pattern already used for headings, math, and tables. Agreed as the direction, not yet built: it changes the visual spacing of every existing in-place document and needs its own scoped change, tracked separately.

## A framing note

This request was relayed through Sympose, the app it was found in — but per a standing project practice, it's treated as a general Stylo capability gap, not a Sympose-specific one throughout: every fix above benefits any consumer rendering both `in-place` and `preview` for the same document, and nothing here is Sympose-specific.
