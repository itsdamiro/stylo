---
title: "A browser test harness — Playwright over the in-place canvas"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# A browser test harness — Playwright over the in-place canvas

## Context

The in-place canvas is the part of Stylo that jsdom cannot test. Its behaviour is layout and pointer interaction: markers reveal when the caret enters a line, click-to-position runs through `coordsAtPos`, the selection bar and the right-click menu are `position: fixed` popups that clamp to the viewport, and the sticky toolbar holds its place through a `requestAnimationFrame` watchdog because iOS Safari would otherwise drop it on scroll. jsdom gives every element a zero box, so none of that can be asserted there.

The cost showed in the journal: the sticky-toolbar fix went through `translateZ(0)`, then `position: sticky`, then the rAF watchdog, each verified by hand in real Chrome; the token-decoupling and font work each closed with a note that the visuals "still want a real-Chrome look." The standing rule became _reproduce in a browser before claiming a fix_ — a rule with no automation behind it.

## Decision

Add [`@playwright/test`](https://playwright.dev) as a dev dependency and a `test/browser/` suite, run with `npm run test:browser` and in its own CI job.

- **Playwright, not Vitest browser mode.** The hard cases here are real right-click, real caret movement, and the rAF watchdog under a genuine scroll — Playwright's model fits them, and it is what the manual verification already used. The Vitest + jsdom suite stays the fast first line of defence; the two never overlap (`*.spec.ts` vs `*.test.ts`, and `test/browser/**` is excluded from the Vitest config).
- **A dedicated fixture, not the playground.** [`playground/fixture.html`](../../playground/fixture.html) is a bare `<Stylo>` mount whose entire config comes from URL query params (`?mode=…&selectionUI=bar&reveal=caret&sticky=top&doc=long`). Deterministic, no control-panel chrome, and it rides the existing Vite dev server — no second build setup. Playwright's `webServer` runs `npm run dev -- --port 5199 --strictPort` and reuses a server already up outside CI.
- **CI now.** A `browser` job installs Chromium (`--with-deps`) and runs the suite. A harness that isn't gated rots.

## What the first cut covers

Eleven tests across five files, aimed at what has actually broken:

- `reveal="caret"` marker reveal — the `# ` on a heading is a replace-widget with the caret elsewhere and editable text with the caret on the line.
- Heading renders visibly larger than body text (computed `font-size`).
- Selection bar (`selectionUI="bar"`) appears on a selection, stays on-screen, and **yields while the right-click menu is open** — the coordination added in the font-size / menu pass, which jsdom could only check at the state-field level.
- Right-click menu opens, clamps inside the viewport near an edge, dismisses on an outside click.
- Sticky toolbar stays at `y ≈ 0` through a 1500px window scroll.
- KaTeX renders with real dimensions in `preview` and on the in-place canvas.

## Consequences

- New dev dependency and a Chromium download in CI (~1–2 min, cached). Never ships — Playwright is test infra, absent from `dist/` and `package.json` `dependencies`.
- Contributors touching layout or pointer/caret code are expected to extend this suite; `CONTRIBUTING.md` says so.
- Follow-ups: table-cell editing interactions, touch (`pointer: coarse`) emulation for the long-press menu, and a visual-regression pass once the layout stops moving.
