---
title: "A line-count gate for the 200-line ceiling"
created: 2026-10-15
type: journal
parent: index
tags:
  - stylo
  - engineering
  - standard
---

# A line-count gate for the 200-line ceiling

## Context

The 200-line ceiling for source files in `src/` was checked by reading, and nine files had crossed it unnoticed. [ADR-016](../../decisions/016-line-count-gate.md) decided a gate with an allowlist that only shrinks, accepted by the owner the same day.

## What changed

- **`scripts/check-line-count.mjs`** walks `src/` for `.ts` and `.tsx`, counts lines as `wc -l` does, and fails a file over 200 unless it is in the allowlist at the top of the script. Node's standard library only.
- **The allowlist holds nine files at their current lengths:** `table-widget.ts` 425, `types/core.ts` 234, `theme-canvas.ts` 225, `inline-ops.ts` 207, `StyloToolbarSettings.tsx` 204, `command-helpers.ts` 202, `context-menu-actions.ts` 202, `context-menu.ts` 201 and `table-cell-marks.ts` 201.
- **It is wired in as `npm run check:lines`,** a `lines` line in `scripts/gates.conf` after `theme`, a step in the CI workflow beside `check:theme`, and the verify list in `CONTRIBUTING.md`.
- **No consumer-visible change,** so no changelog entry.

## Proof

Run by hand against a working copy, restored from a backup after each case:

- **Passes on the tree as it stands:** nine entries, exit 0.
- **Fails when a listed file grows by a line:** `context-menu.ts` at 202 against its entry of 201, exit 1.
- **Fails when an unlisted file passes 200:** `types/inplace.ts` raised to 201, exit 1.
- **Fails when a listed file is brought to 200 or fewer:** `table-cell-marks.ts` at 200, with a message to delete its entry, exit 1.

## Left open

The nine splits, each in a slice of its own that deletes its entry; whether the rule covers CSS; and the six files at 191 to 199, which the gate does not warn about.
