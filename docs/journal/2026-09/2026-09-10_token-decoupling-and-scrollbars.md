---
title: "Token decoupling — a floating-surface token, a ring/accent split, scrollbar styling"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Token decoupling — a floating-surface token, a ring/accent split, scrollbar styling

Three theming seams surfaced by a downstream integration trial (dropping `<Stylo>` into an existing card in a consuming app). None changes a public prop; one adds a token, one repoints an existing token, one adds CSS to a class that had none. ADR-002 §3 amendment.

## `--stylo-bg` was doing the popover's job

Every floating in-place popup drew its background from `--stylo-bg`:

- `.cm-inplace-menu-panel` — the right-click / long-press context menu
- `.cm-inplace-menu-input` — the link-URL field inside it
- `.cm-inplace-selbar` — the selection formatting bar
- `.cm-inplace-href-tip` — the link-hover tooltip

`--stylo-bg` is also the base editing-surface background. Embedding the editor in a card and setting `--stylo-bg: transparent` so the card shows through — an entirely reasonable move — then made all four popups transparent too. They kept their border and shadow but the content behind them showed straight through: no error, just an unreadable menu.

Fix: a ninth token, **`--stylo-surface-floating`**, backs those four rules instead. It defaults to `#ffffff` / `#09090b` — the same colours `--stylo-bg` ships — so the out-of-the-box look is unchanged, but it is a **concrete colour, not `var(--stylo-bg)`**. A transparent (or retinted) base surface no longer touches the popups. A host theming `--stylo-bg` to a non-default colour sets this one alongside it.

This is the role shadcn carries as `--popover`, which Stylo's token set had folded into `--stylo-bg`. Splitting it out is one token for one real role, not the shadcn-style sprawl ADR-002 rejects — the popup surface genuinely is not the document surface.

## `--stylo-ring` was doing two jobs

`--stylo-ring` was both:

- the focus-ring outline (`.cm-editor.cm-focused`, `.toolbarButton:focus-visible`, the table-cell focus box-shadow, the menu-input focus border), and
- the in-place menu's **active-row** accent (`.cm-inplace-menu-item[data-active]` text + icon colour).

A host wanting to drop or soften the focus outline — a common preference — could not do it through the token without also recolouring the menu's active row.

Fix: the active row now follows `--stylo-accent`, whose documented role is already "active / pressed states" — the menu's current selection is exactly that. `--stylo-ring` is the focus ring only now. The default active-row colour shifts from mid-grey (`#a1a1aa`) to near-body-text with the existing `600` weight, which reads as a stronger "this is selected" cue than the greyed-back look it replaced.

## `.cm-scroller` had no scrollbar styling

The editing surface's own scroll container — `.cm-scroller`, shared by `source`, `in-place`, and the source pane of `split` — carried zero scrollbar CSS, while the toolbar, context menu, and selection bar each had a full design pass (padding, radius, hover states, a touch-sizing media query). It fell back to the browser's default-weight bar, visibly heavier than thin native scrollbars elsewhere in a host app.

Added a thin, token-tinted treatment in `stylo.module.css`: `scrollbar-width: thin` + `scrollbar-color` for Firefox and current Chromium, a small `::-webkit-scrollbar` block for WebKit and older Chromium, both keyed off `--stylo-border` / `--stylo-text-muted`. Scoped under `.root`, so a host's own `.cm-scroller` rules load after and win.

## Also: `codeLanguages` discoverability

Not a code change — a documentation gap from the same trial. Fenced code renders in flat, uncoloured monospace until `codeLanguages` is passed (Stylo bundles no grammars, by design — ADR-001 amendment). Nothing in the editor hinted at that; you had to read the fenced-code reference in full to learn the fix. The README now says it in the props section, and the reference leads with the symptom.

## Files

- `src/styles/tokens.css` — `--stylo-surface-floating`, light and dark.
- `src/inplace/theme.ts` — four popup backgrounds repointed to `--stylo-surface-floating`; active menu row repointed to `--stylo-accent`.
- `src/styles/stylo.module.css` — `.cm-scroller` scrollbar rules.
- `README.md`, `docs/wiki/reference/code-languages.md` — `codeLanguages` symptom note.
- `docs/wiki/reference/props.md` — token table (nine), the non-alias note.

## Log

- 2026-09-10 — `--stylo-surface-floating` added and threaded through the four floating popups; `--stylo-ring` narrowed to focus-only with the menu active row moved to `--stylo-accent`; `.cm-scroller` given thin token-tinted scrollbars. `check:theme` green (10 paired colours). The floating-popup and active-row visuals still want a real-Chrome look against a transparent host card.
