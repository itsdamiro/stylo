---
title: "Customization API — in-place decoration toggles"
created: 2026-09-01
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Customization API — in-place decoration toggles

First slice of the developer customization API from [ADR-002](../../decisions/002-editor-ux-and-customization.md), specified in [ADR-005](../../decisions/005-in-place-decoration-toggles.md): a single `inPlace` prop whose `decorations` record turns individual in-place decoration types off, leaving that construct as plain source.

## Context

The [in-place canvas](./2026-09-01_in-place-canvas.md) renders twelve Markdown constructs. Which ones a host wants depends on the field — a CMS body, a comment box, and a raw-notes surface each want a different subset. The recurring "can we turn X off?" question through the canvas build is answered here.

## Scope

- **In:** per-type enable/disable toggles for all twelve constructs, via `inPlace={{ decorations: { … } }}`. Default is every key `true` — unchanged behaviour.
- **Out (deferred, each its own decision):** `reveal: "line" | "node"`, frontmatter display mode, table rendering options, any consumer decorator hook or CodeMirror extension pass-through.

## Design

- One grouped `inPlace` object prop, so `reveal` and `frontmatter` groups can join `decorations` later without new top-level props.
- A CodeMirror `Facet` (`inPlaceConfigFacet`) carries the resolved toggles; each of the four decoration producers (view plugin, `blockMathField`, `frontmatterField`, `tableField`) reads it and skips a disabled construct.
- The state fields stay singletons — the facet, not a factory, holds config — so the existing suite is untouched.
- Config is read at canvas construction; runtime changes need a remount.

## Increments

| #   | Increment                                                         | Status | Notes                                                                                              |
| --- | ----------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| 1   | ADR-005; journal note; ADR + wiki index sync                      | ✅     | Design on paper; deferred items named explicitly.                                                  |
| 2   | `inPlaceConfigFacet`, producer gates, `inPlace` prop, tests, docs | ✅     | `src/inplace/config.ts`; gates in the four producers; `InPlaceConfig` types; playground toggle UI. |

## Log

- 2026-09-01 — increment 1: ADR-005 written; scope fixed to on/off toggles only, with reveal mode, frontmatter display mode, table options, and any decorator hook explicitly deferred. Shape settled as one `inPlace` object prop; mechanism settled as a facet read by all four producers, fields kept as singletons. Journal, ADR index, and wiki index synced.
- 2026-09-01 — increment 2: `src/inplace/config.ts` adds `inPlaceConfigFacet` and `resolveToggles`, defaulting every key `true`. `inPlaceExtension` seeds the facet from the new `inPlace` option; the view plugin's `decorate.ts`, `nodes.ts`'s per-branch checks, and the `math` / `frontmatter` / `tables` state fields all read it and skip their construct when its key is `false`. `InPlaceDecorationToggles` and `InPlaceConfig` are new public types in `src/types.ts`, exported from the barrel; `Stylo` threads `inPlace` through to `InPlaceView`, which bakes it into the extension array built once at mount. Five new tests cover a representative toggle per producer plus the `tasks`/`lists` interaction (`tasks: false` leaves `- [ ]` fully as source). The playground gained a "Customize in-place decorations" panel with all twelve checkboxes, remounting the canvas via a config-derived `key` — a live demo of the construction-time rule. New wiki page [in-place-config.md](../../wiki/reference/in-place-config.md); `props.md` gained the `inPlace` row.
- 2026-09-02 — playground verification turned up four real issues, fixed in the same slice:
  - **Frontmatter re-check did nothing.** A fresh `EditorState`'s default caret sits at position 0 — inside the frontmatter block — so `frontmatterField` always started "revealed" (no chip) on any mount, a pre-existing bug the toggle's remount made visible every time. Fixed: the field now starts folded unconditionally and only reveals on a real selection change.
  - **`code` toggle didn't affect inline code.** Inline `` `code` `` had been grouped under `emphasis` in `nodes.ts`'s shared inline-rule table. Split: the table now carries a `toggle` per entry, so `code` covers inline code and fenced/indented blocks, `emphasis` covers bold/italic/strike only.
  - **Blockquote `>` never hid.** ADR-004 originally kept blockquote markers always visible. Changed (amending ADR-004) so `>` hides off-caret and reveals on-caret like every other marker, via a new `QuoteMark` case; `blockquote: false` now also stops the hiding, not just the framing.
  - **Clicking a rendered widget was hit-or-miss.** A click on KaTeX internals or the empty parts of an `<hr>` / the chip could leave the caret unplaced, so nothing revealed. Added a narrow `mousedown` handler in `inPlaceExtension` that, for a click inside a rendered widget (`.cm-inplace-math`, `-hr`, `-frontmatter`, `-table`), drops the caret at the widget's document position (amending ADR-004's "click a widget → caret at its edge" claim); `HrWidget` and `FrontmatterWidget` also needed `ignoreEvent` flipped to `false` for the handler to see their events. Text and line padding stay with CodeMirror; an earlier version that also intercepted decorated-line padding was reverted — it forced the caret to a line edge and broke precise clicking in revealed source.

## Known issue — immediate follow-up

Decorations that **collapse line height** desync CodeMirror's click → document position mapping: a click lands on the line above or below the target. Confirmed in the playground by toggling constructs off one at a time.

- **Frontmatter chip** — the main offender. A `block: true` widget replaces the four-line YAML block with a one-line chip; every click below it drifts. Turning `frontmatter` off restores accurate clicking.
- **Fenced code** — the `cm-inplace-code-pad` rows render at `height: 0`; milder drift around and below a code block.

Pre-existing (both predate this slice); the "chip shows on mount" fix just made the frontmatter case visible on every load. The fix is to stop collapsing line height — keep the YAML rows full-height but dimmed with a label, and give code fences real row height — tracked as the next task, not folded in here so the toggle slice can land verified.

## After this slice

- `inPlace.reveal` — `"line" | "node"` cursor-reveal granularity.
- `inPlace.frontmatter` — `source` / `chip` / `properties` display mode; the `properties` panel waits on the deferred YAML exposure work (its own ADR).
- Table rendering options — inline cell formatting, style hooks.
- Consumer decorator hook — its own ADR once concrete use cases exist.
