---
title: "Stylo.tsx split under the 200-line ceiling"
created: 2026-10-15
type: journal
parent: index
tags:
  - stylo
  - engineering
  - standard
---

# Stylo.tsx split under the 200-line ceiling

## Context

`src/Stylo.tsx` was 245 lines against the 200-line ceiling in `CONTRIBUTING.md`; it was already over before `imageSource` added to it. [ADR-015](../../decisions/015-split-stylo-tsx-under-the-ceiling.md) decided the split, accepted by the owner the same day.

## What changed

- **`src/useStyloHandle.ts`** holds the imperative handle and the two source refs; `scrollToHeading` is a function above the hook.
- **`src/toolbar/StyloToolbar.tsx`** resolves the toolbar config and draws the bar, through a host's `render` when given. `stickyEdge` returns the edge for the root's class.
- **`src/Stylo.tsx`** is now 184 lines: props in, surfaces out. No behaviour or public API change, and no test needed to change.
- **The size script's budget key `config` became `icons`.** The shared toolbar chunk is the same code, named after a different module now; the limit is unchanged. `stylo.js` grew 50 B gzip, to 5,788 B of 6,000 B.
- **Still over the ceiling, left out on purpose:** `table-widget.ts`, `types/core.ts`, `theme-canvas.ts` and `inline-ops.ts`; no gate enforces the ceiling.
