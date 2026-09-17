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

Concept-based documentation for **Stylo**, a plain-text-first Markdown editor for
React with first-class LaTeX (KaTeX) support.

## Navigation

### Architecture

- [[architecture/overview|System Overview]] — the plain-text-first model, the
  composed stack, and the render pipeline.

### Guides

- [[guides/integration|Integrating Stylo]] — which props are live vs. read at
  mount, persistence, stylesheet and peer-dependency setup, and the theming
  contract.
- [[guides/autosave|Auto-save]] — why it is not a prop, and a `useAutosave`
  hook that debounces `onChange` and flushes before the tab closes.
- [[guides/layout-and-touch|Layout and touch]] — the three page layouts, the
  full-height recipe that pins a toolbar for free, and what to expect from the
  context menu, menu sizing, and caret placement on touch.

### Reference

- [[reference/props|`<Stylo>` props]] — the current prop surface, styling tokens,
  and math setup.
- [[reference/toolbar|Formatting toolbar]] — the `toolbar` prop, command ids,
  keyboard shortcuts, and the `icons` override.
- [[reference/toolbar-settings|`<StyloToolbarSettings />`]] — the opt-in
  end-user customizer for the formatting bar.
- [[reference/in-place-config|In-place canvas configuration]] — the `inPlace`
  prop and its decoration toggles.
- [[reference/code-languages|Fenced-code highlighting]] — the `codeLanguages`
  prop and how to opt into language grammars.

## Engineering journal

Chronological milestones and Architectural Decision Records live outside the wiki,
under `docs/journal/YYYY-MM/`. The master ADR index is
[`docs/PROJECT_JOURNAL.md`](../PROJECT_JOURNAL.md).

| ADR     | Title                                                                 | Status   |
| ------- | --------------------------------------------------------------------- | -------- |
| ADR-011 | Embed cache invalidation: a host-triggered `invalidateEmbed`          | Accepted |
| ADR-010 | A canvas header panel, docked under find/replace                      | Accepted |
| ADR-009 | Rendering host React nodes in the in-place canvas                     | Accepted |
| ADR-008 | CodeMirror and Lezer as peer dependencies                             | Accepted |
| ADR-007 | Seamless in-place: Markdown markers never shown                       | Accepted |
| ADR-006 | Interactive rendered-table editing                                    | Accepted |
| ADR-005 | In-place decoration toggles                                           | Accepted |
| ADR-004 | In-place decoration canvas                                            | Accepted |
| ADR-003 | Math rendering engine and KaTeX asset delivery                        | Accepted |
| ADR-002 | Editor UX, Customization API, and Design System                       | Accepted |
| ADR-001 | Editor architecture: compose from primitives, plain text is canonical | Accepted |
