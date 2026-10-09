---
title: "A surface-parity rule for --stylo-* tokens — in-place leads, preview's reach is decided, not assumed"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# A surface-parity rule for `--stylo-*` tokens

Reviewing the preview typography + code-highlighting request turned up two tokens — `--stylo-font-size` and the eleven `--stylo-syntax-*` tokens — that the in-place canvas has read since they were introduced, and `preview` never has. Tracing why landed on [ADR-002 §3](../../decisions/002-editor-ux-and-customization.md)'s tenth-token amendment, which claims `--stylo-font-size` "backs that rule on every surface." It doesn't, and never did — only `.cm-editor` reads it. The claim just went unchecked.

## What was already true

Grepping every `--stylo-*` name against `stylo.module.css` first, so the fix below starts from a complete list rather than another partial one:

- **Already shared, correctly:** `--stylo-bg`, `--stylo-text`, `--stylo-text-muted`, `--stylo-border`, `--stylo-link`, `--stylo-radius`, `--stylo-font-family-mono`, and the three `--stylo-table-*` tokens.
- **Correctly in-place-only** (preview has no equivalent concept, so it isn't a gap): `--stylo-ring` (a focus outline; preview isn't focusable), `--stylo-surface-floating` (floating popups; preview has none), `--stylo-guide` (CodeMirror's list-indent-guide rail; preview's nested lists render as literal nested `<ul>`/`<ol>`, no rail needed), and `--stylo-accent` (toolbar active-state; preview has no toolbar).
- **Actually missing, both silently:** `--stylo-font-size` and every `--stylo-syntax-*` token.

Two real gaps, not eleven — but two more than a document that says "every surface" should have.

## The rule

Formalized as a dated amendment to [ADR-002 §3](../../decisions/002-editor-ux-and-customization.md): the in-place canvas stays the reference surface a new token is introduced against — that was already every amendment's actual practice — but a token's reach onto `preview` (and `split`, which is just `source` + `preview` side by side) now has to be **decided and written down in the same change**. "Not applicable" is a fine answer when preview has nothing analogous; silence isn't, because silence is what let `--stylo-font-size` sit half-wired with no one noticing until a host toggled modes on the same document and watched it visibly drift.

`CONTRIBUTING.md` carries the same rule as a checklist line, so it's checked before a token ships, not rediscovered after.

## Closing the two gaps

Both landed in the same change, as the rule's first application (ADR-002 §3's second 2026-09-13 amendment):

- `.preview`'s base `font-size` (`stylo.module.css`) is now `var(--stylo-font-size, 0.9375rem)` instead of a literal `0.9375rem`. Every descendant rule in the scale was already `em`-based off that one value, so nothing else needed changing; `padding` moved from a fixed `rem` to a matching `em` value so it tracks the base size too instead of going oversized against a smaller host-set one.
- Fenced code in `preview` now highlights. `src/editor/highlight.ts` gained `SYNTAX_TAG_GROUPS`, the shared tag → token list `styloHighlightStyle` (the live CodeMirror extension) now builds from. A new `src/render/highlightCode.ts` resolves a fence's language through the exact rules `@codemirror/lang-markdown` uses for `codeLanguages`, parses the block once with the resolved grammar, and walks it with `@lezer/highlight`'s `highlightTree` against that same `SYNTAX_TAG_GROUPS` list — outside of any `EditorView`, since `preview` has none — emitting `stylo-tok-<token>` spans that `stylo.module.css` colours with the same `--stylo-syntax-*` tokens. A new `src/render/CodeBlock.tsx` renders plain text immediately and swaps in the coloured spans once that resolves, so there's no loading flash. Both `@lezer/highlight` and `@codemirror/language` are peer dependencies already (for the CodeMirror surfaces), so this shipped with no new dependency. `codeLanguages` is unchanged in every other respect: still opt-in, still read once at mount on the CodeMirror surfaces, still exactly as lazy per-language.

## Not automated

The both-blocks light/dark rule has a CI guard (`check:theme`) because it's a mechanical check — every colour name in one block, cross-referenced against the other. Surface parity isn't mechanical the same way: it needs a human judgment call about which surfaces a token's _role_ applies to, not a name match. Left as a documentation discipline for now, with an explicit revisit trigger if it fails a third time.

## Verification

- `npm run format:check`, `npm run check:theme`, `npm run typecheck`, `npm run build` — clean. The shared `SYNTAX_TAG_GROUPS` module now lands in its own chunk (`highlight-*.js`, ~1.1 kB gzip, shared by the in-place canvas and `preview`); added a matching entry to `scripts/check-bundle-size.mjs`, which otherwise fails on any unbudgeted chunk.
- `npm run check:size`, `npm run check:package` — clean.
- `npm run test` — 455 passing (was 359 at the last count in this file's neighbourhood, plus everything shipped since); five new in `test/preview-code-highlight.test.tsx` covering: fenced code with no `codeLanguages` stays plain, a resolved language colours its tokens, an unresolvable language name falls back to plain text, the function form of `codeLanguages` is called with the fence's language name, and inline code is never routed through the highlighter.
