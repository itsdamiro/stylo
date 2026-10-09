# Decision records

Records for anything durable: a new dependency, or a decision that outlives the task it was made in (architecture, the public API, what is deliberately deferred). Shape and how to write one: `docs/sop/write-an-adr.md` and `TEMPLATE.md` here. Names, tags and links: `docs/VAULT_CONVENTIONS.md`.

Records 001 to 012 were written as journal entries and moved here by record 013 (2026-10-09), keeping their numbers; the journal now holds the milestones only (`docs/PROJECT_JOURNAL.md`).

| #                                                | Decision                                                              | Status   |
| ------------------------------------------------ | --------------------------------------------------------------------- | -------- |
| [001](001-editor-architecture.md)                | Editor architecture: compose from primitives, plain text is canonical | Accepted |
| [002](002-editor-ux-and-customization.md)        | Editor UX, Customization API, and Design System                       | Accepted |
| [003](003-katex-math-rendering.md)               | Math rendering engine and KaTeX asset delivery                        | Accepted |
| [004](004-in-place-decoration-canvas.md)         | In-place decoration canvas                                            | Accepted |
| [005](005-in-place-decoration-toggles.md)        | In-place decoration toggles                                           | Accepted |
| [006](006-interactive-table-editing.md)          | Interactive rendered-table editing                                    | Accepted |
| [007](007-seamless-in-place.md)                  | Seamless in-place: Markdown markers never shown                       | Accepted |
| [008](008-codemirror-peer-dependency.md)         | CodeMirror and Lezer as peer dependencies                             | Accepted |
| [009](009-react-nodes-in-the-in-place-canvas.md) | Rendering host React nodes in the in-place canvas                     | Accepted |
| [010](010-canvas-header-panel.md)                | A canvas header panel, docked under find/replace                      | Accepted |
| [011](011-embed-cache-invalidation.md)           | Embed cache invalidation: a host-triggered `invalidateEmbed`          | Accepted |
| [012](012-host-extensions-prop.md)               | A host `extensions` prop, and gutters a host can show                 | Accepted |
| [013](013-adr-records-live-in-docs-decisions.md) | Decision records live in docs/decisions, in the template shape        | Accepted |
