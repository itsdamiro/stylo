---
title: "Exiting an editable table downward could land the caret above it; insertTable now leaves room to move past one"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Exiting a table downward landed the caret above it

Reported directly, confirmed in real Chromium before touching anything (per the project's standing rule for caret/layout bugs jsdom can't be trusted for): pressing ArrowDown out of the last row of an `inPlace={{ table: "cells" }}` table, with nothing after it in the document, put the caret on the blank line _above_ the table's heading instead of on a new line below it.

## Reproducing it

A one-off Playwright script against the `playground/fixture.html` harness (`?doc=table&table=cells`, already the only fixture doc with a table as the document's last block) confirmed it visually — a screenshot showed the caret sitting right after the `# Table` heading, nowhere near the row the arrow key was pressed from.

## Root cause

`table-widget.ts`'s `exitBelow()` computed the table's end position (`to`, from `bounds()`) and dispatched `selection: { anchor: Math.min(to + 1, doc.length) }`. With the table as the document's last content, `to` already equals `doc.length`, so the clamp collapses to `anchor: to` — a position sitting exactly on the atomic table decoration's own boundary (`tableField` registers the whole table as an `EditorView.atomicRanges` region). With nothing past that boundary to distinguish "just after the table" from "the table's own edge," CodeMirror's atomic-range resolution could snap the position to the wrong side.

## The fix

`exitBelow()` no longer trusts a bare boundary position when there's nothing past it — it inserts the line the exit actually needs first:

```ts
if (to >= view.state.doc.length) {
  view.dispatch({ changes: { from: to, insert: "\n" }, selection: { anchor: to + 1 } })
  return
}
view.dispatch({ selection: { anchor: to + 1 } })
```

Once there's a real character position past the table to land on, the ambiguity is gone by construction rather than by hoping the boundary resolves the intended way.

## `insertTable` got the same treatment, for the same reason

`toolbar/table.ts`'s `insertTable` closed a freshly inserted skeleton with a single `"\n"` — no blank line after it. A table landing at the end of a document (the common case — inserting a table is usually the last thing someone does before moving on to write more) had exactly the setup that triggers the bug above, the moment it was created, plus no line for the caret to move into even before pressing anything. Now closes with `"\n\n"` unconditionally: simpler than trying to detect whether enough separation already exists nearby (an earlier draft tried exactly that, using the following line's blankness to skip the extra line — it produced correct but confusing, hard-to-verify-by-hand newline counts in edge cases for a purely cosmetic saving, so it was dropped in favour of always leaving one full blank line).

## Verification

- Reproduced and confirmed fixed in real Chromium first, via a temporary diagnostic script, before writing the permanent regression test.
- `npm run format:check`, `npm run check:theme`, `npm run typecheck`, `npm run build`, `npm run check:package` — clean.
- `npm run check:size` — `InPlaceView`'s budget bumped 22,000 → 23,000 B gzip; the last three fixes in a row (`0.13.1`, `0.13.2`, this one) had worn it down to 27 B of headroom.
- `npm run test` — 462 passing (2 new in `test/table.test.tsx`: a trailing blank line after a freshly inserted table, and a blank line separating the table from content that immediately follows it).
- `npm run test:browser` — 31 specs passing, including a new `test/browser/table-widget.spec.ts` that reproduces the exact ArrowDown scenario and asserts the resulting line renders below the table, not above it. Confirmed this test actually catches the regression by reverting the `exitBelow` fix and watching it fail before restoring it.
