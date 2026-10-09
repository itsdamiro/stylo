---
title: "Preview frontmatter display — the frontmatter prop"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Preview frontmatter display — the `frontmatter` prop

## Context

`preview` (and the preview pane of `split`) dropped the leading `---` YAML block entirely — `remark-frontmatter` parses it and `react-markdown` renders nothing for the node. Consumers building a CMS or notes UI often want that block on screen, styled to their own design. The full Obsidian-style parsed key/value panel is deferred (ADR-001 — it needs a YAML parser dependency and an `onFrontmatter` prop). Showing the **raw** block needs neither.

## What was built

**`frontmatter?: "hidden" | "code"`** on `<Stylo>` (type `FrontmatterDisplay`, exported), threaded to `Preview` through `Stylo` and `SplitView`.

- `"hidden"` (default) — unchanged; `remark-frontmatter` keeps it out of the body.
- `"code"` — `Preview` renders the inner YAML as `<div class="stylo-frontmatter">` above the Markdown body. `remark-frontmatter` still strips it from the body, so it is not duplicated.

**`splitFrontmatter(md)`** added to the shared `src/frontmatter.ts` — a regex (`/^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/`) that slices the leading block off the string. No parser, no dependency; empty blocks return `""`.

**Styling.** `.stylo-frontmatter` is a **plain, unscoped** class (emitted via `:global()` from the CSS module), so a consumer's own rule overrides it at equal specificity — restyle the block, or rename / remove the label:

```css
.stylo-frontmatter {
  border-left-color: var(--stylo-accent);
}
.stylo-frontmatter::before {
  content: "Meta";
} /* rename */
.stylo-frontmatter::before {
  content: none;
} /* remove   */
```

The default look: recessed, monospace, `--stylo-*`-token driven, with an uppercase `Frontmatter` label from `::before`.

**Label rename.** The in-place canvas's recessed YAML block had a `"Properties"` `::before` label (`src/inplace/theme.ts`); it now reads `"Frontmatter"` too, so both surfaces name the raw block the same way and neither is confused with a parsed-properties view.

## Verification

`typecheck`, 78 Vitest tests (2 new in `test/preview.test.tsx` — `"code"` renders the block under `.stylo-frontmatter` and the default stays hidden), `build`, and `format:check` all pass. No new chunks; `remark-frontmatter` is still the only frontmatter dependency.

## Follow-ups

- `onFrontmatter` (parsed data to the host) and a rendered key/value panel — still deferred, still gated on the YAML-parser decision in ADR-001.
- An in-place equivalent (`source` / `inline` / `properties` display modes) — tracked in the [in-place canvas note](./2026-09-01_in-place-canvas.md).
