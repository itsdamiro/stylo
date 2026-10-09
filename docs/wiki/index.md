---
title: "Stylo Wiki — Home"
created: 2026-09-01
type: wiki-reference
parent: index
tags:
  - stylo/wiki
  - engineering/standard
---

# Stylo Wiki

Concept-based documentation for **Stylo**, a plain-text-first Markdown editor for React with first-class LaTeX (KaTeX) support.

## Navigation

### Architecture

- [[architecture/overview|System Overview]] — the plain-text-first model, the composed stack, and the render pipeline.

### Guides

- [[guides/integration|Integrating Stylo]] — which props are live vs. read at mount, persistence, stylesheet and peer-dependency setup, and the theming contract.
- [[guides/autosave|Auto-save]] — why it is not a prop, and a `useAutosave` hook that debounces `onChange` and flushes before the tab closes.
- [[guides/host-extensions|Extending Stylo with CodeMirror extensions]] — the `extensions` prop: marks, widgets, gutters, and what to avoid on the canvas.
- [[guides/layout-and-touch|Layout and touch]] — the three page layouts, the full-height recipe that pins a toolbar for free, and what to expect from the context menu, menu sizing, and caret placement on touch.

### Reference

- [[reference/props|`<Stylo>` props]] — the current prop surface, styling tokens, and math setup.
- [[reference/toolbar|Formatting toolbar]] — the `toolbar` prop, command ids, keyboard shortcuts, and the `icons` override.
- [[reference/toolbar-settings|`<StyloToolbarSettings />`]] — the opt-in end-user customizer for the formatting bar.
- [[reference/in-place-config|In-place canvas configuration]] — the `inPlace` prop and its decoration toggles.
- [[reference/code-languages|Fenced-code highlighting]] — the `codeLanguages` prop and how to opt into language grammars.

## Engineering journal and decisions

Chronological milestones live outside the wiki, under `docs/journal/YYYY-MM/`; the index is [`docs/PROJECT_JOURNAL.md`](../PROJECT_JOURNAL.md). The Architectural Decision Records, with their index, are in [`docs/decisions/`](../decisions/README.md).
