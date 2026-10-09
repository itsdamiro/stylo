---
title: "preview's fenced code blocks wrap by default, behind a new override token"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `preview`'s fenced code blocks wrap by default, behind a new override token

Closes [the preview-code-blocks-dont-wrap request](../../requests/2026-09-13_preview-code-blocks-dont-wrap.md), filed after Sympose's read/edit toggle put the same document through both `preview` and in-place back to back: a long unbroken code line scrolled horizontally in `preview` (`.preview pre`'s `scrollWidth` 1784px against a 412px panel) but wrapped cleanly in in-place (`.cm-scroller` at parity, 476px/476px) — the same document reading two different ways depending on which surface happened to have it open.

## Root cause

`.preview pre` (`stylo.module.css`) set margin, padding, border-radius, background, and `overflow-x: auto`, but never `white-space` — so it inherited `<pre>`'s UA-stylesheet default, `white-space: pre`, which suppresses wrapping regardless of how many break points a line has. In-place's wrap was never a deliberate per-construct decision: `EditorView.lineWrapping` sits in `baseExtensions` and applies to the whole CodeMirror document, prose and fenced code alike, because CodeMirror has no built-in concept of "wrap this line differently, it's inside a code fence."

## Decision

`.preview pre` now sets `white-space: var(--stylo-preview-code-white-space, pre-wrap)` and `overflow-wrap: break-word`, with `overflow-x: auto` kept as a safety net for the pathological single-unbroken-run case `overflow-wrap` doesn't catch on its own. Default behaviour changes: `preview` now matches in-place instead of the GitHub/Obsidian/VS Code convention of leaving code blocks in a horizontal scroller. That trade-off was raised and accepted in the originating request — in-place is the surface actually used while writing, and the same document disagreeing with itself across modes was judged the more visible problem.

The token, not a flat hardcode, is what makes the trade-off reversible. The request itself flagged that `.preview pre`'s CSS-module class is a hashed, unstable selector — Sympose (or anyone) had no way to opt back into horizontal scroll even if this default didn't suit them. `--stylo-*` custom properties are Stylo's existing override mechanism for exactly this (radius, font tokens, table/callout colours), so this follows that convention rather than inventing a new one: `--stylo-preview-code-white-space: pre;` on any ancestor restores the old behaviour, no new prop, no JS API surface.

Recorded in [ADR-002 §3](../../decisions/002-editor-ux-and-customization.md) as a surface-parity amendment, in the direction the rule hadn't seen yet: the token is `preview`-only, permanently, not as an oversight. In-place has no whole-document `white-space` toggle to parameterize the same way — its wrap is a single document-wide extension, not a per-construct one — so there's no symmetrical in-place token to add. Giving in-place independent code-vs-prose wrap control would mean a syntax-tree-aware CodeMirror extension, a materially larger change than this request scoped.

## Verification

- `npm run format:check`, `npm run typecheck`, `npm run build` — clean.
- `npm run test` — clean; no existing test asserted `.preview pre`'s `white-space`, so none needed updating for the default-behaviour change.
- Documented in `docs/wiki/reference/props.md`'s styling-tokens table.
