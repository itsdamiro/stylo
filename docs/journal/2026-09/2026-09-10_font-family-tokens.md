---
title: "Font-family tokens — the prose and mono stacks move onto the contract"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Font-family tokens — the prose and mono stacks move onto the contract

The [font-size token](./2026-09-10_font-size-token-and-menu-selbar-coordination.md) closed one seam a downstream integration had complained about; this is the same seam one level up. `font-family` was hard-coded in roughly eight places and a host wanting the editor in its own typography had to reach past the `--stylo-*` contract into `.cm-content`.

## Two tokens, two roles

- **`--stylo-font-family`** — the reading/prose font. Default is the system sans stack that was inline (`-apple-system` → `sans-serif`). Threaded through the in-place `.cm-content` (`inplace/theme.ts`), the `.cm-inplace-fm-first::before` and `.stylo-frontmatter::before` "Frontmatter" labels, and `.toolbarSticky` (`stylo.module.css`) — the fixed-position sticky toolbar, which cannot inherit a font from the mount point the way the in-flow `.toolbar` does.
- **`--stylo-font-family-mono`** — the code font. Default `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. Threaded through source-mode `.cm-content` (`editor/theme.ts`), the in-place `MONO` constant (code spans, fenced blocks, the raw-frontmatter rows), `.toolbarButton code` (the `fm` text glyph), and `.preview code` / `.preview pre` / `.stylo-frontmatter`.

Both are `var(--token, <full fallback stack>)`, so the JS themes still resolve correctly if a consumer loads the CodeMirror theme without `tokens.css`.

## Decisions

- **Two tokens, not one.** Prose and monospace are roles a host re-skins independently — a brand serif for reading, a specific mono for code. Collapsing them would force one to follow the other.
- **Defaults are the old inline stacks**, so there is no visual change until a host opts in — same discipline as the font-size token.
- **`preview` prose is left inheriting the host font.** It never set a `font-family`; a rendered document reading in the page's own typography is the right default, and pointing it at `--stylo-font-family` (whose default is a concrete stack, not `inherit`) would have _removed_ that inheritance. The token's scope is the editing surface and the chrome that can't inherit.
- **Not colours** — one value each serves both themes, so they sit in the light block only and `check:theme` ignores them, like `--stylo-radius` and `--stylo-font-size`.

## Verification

- `npm run typecheck`, `npm run build`, `npm run check:theme`, `npm run check:size` — clean.
- `npm run test` — 359 passing, unchanged (no behavioural change; the defaults reproduce the prior output).
