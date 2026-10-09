---
type: decision
status: accepted
date: 2026-09-04
projects: [stylo]
concepts: [Peer dependency]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 008 — CodeMirror and Lezer as peer dependencies

> **Summary.** CodeMirror and Lezer become peer dependencies and are kept out of the bundle, so a host installs one copy and shares it. Two copies break extension identity quietly: facets and state from one copy are ignored by the other, with no version error. About 190 kB gzipped leaves the bundle, and a consumer without CodeMirror must install seven packages.

- **Status:** Accepted — implemented 2026-09-04. `@codemirror/*` and `@lezer/*` moved from `dependencies` to `peerDependencies` and externalised from the built bundle.
- **Date:** 2026-09-04
- **Deciders:** damiro, Grace

## Context

Stylo is an editing surface **composed from** CodeMirror 6 — not a wrapper that hides it. The public API leaks CodeMirror on purpose: `getView()` on the imperative handle returns the live `EditorView`, `StyloProps` accepts extra extensions, and a host is expected to read `syntaxTree(state)` or add its own keymap.

Until now the five `@codemirror/*` packages were regular `dependencies`, so the build bundled its own copy of CodeMirror (~190&nbsp;kB gzipped) and shipped it inside `dist/`. For a consumer that also uses CodeMirror — Sympose does — that is the **dual-package hazard**:

- `@codemirror/state` defines `EditorState`, `Facet`, `StateField`, `Annotation`, `Transaction`. These are matched by _identity_. Two copies means a `Facet` created in Stylo's copy is invisible to a plugin from the host's copy; an `EditorState` from one is rejected by an `EditorView` from the other.
- `@codemirror/view` keys plugins and decoration providers the same way.
- `@lezer/common` `Tree` / `SyntaxNode` and `@lezer/highlight` `Tag` identities break the same way if the host inspects or themes the tree.

The failure is quiet — no version error, just extensions that silently don't apply and selections that don't round-trip. The integration review flagged it as a blocker.

## Decision

**Make the CodeMirror and Lezer packages peer dependencies and keep them out of the bundle.** The host installs one copy; Stylo shares it.

- `peerDependencies`: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown`, `@lezer/common`, `@lezer/highlight`. Range `^6.0.0` for CodeMirror, `^1.0.0` for Lezer — the CM6 / Lezer 1 APIs Stylo uses have been stable across the whole line, and a narrow range would force lockstep upgrades on the host for no real safety.
- The same versions stay in `devDependencies` (currently-resolved carets) so the repo's own build, tests, and playground resolve without a separate install step.
- `vite.config.ts` `rollupOptions.external` gains `/^@codemirror\//` and `/^@lezer\//`, next to `react`. The `manualChunks` `codemirror` branch is removed — there is nothing left to chunk.
- `katex` and the `remark` / `rehype` pipeline stay regular `dependencies`. They render the preview, they are not part of the public surface, and a second copy of KaTeX is a size cost, not a correctness bug.

`@lezer/markdown` and `@lezer/lr` are not listed — they arrive transitively through `@codemirror/lang-markdown`, which the host now installs, so a single copy is already guaranteed.

## Consequences

### Positive

- One CodeMirror instance in a host app. `getView()`, extra extensions, and host-side `syntaxTree` reads work against the same module identity Stylo uses.
- ~190&nbsp;kB gzipped leaves Stylo's bundle. `dist/` no longer has a `codemirror` chunk; `check:size` budgets drop it.
- Honest dependency graph — the README and `peerDependencies` now say out loud what a consumer already needed to know.

### Costs / considerations

- **Install friction.** A consumer not already on CodeMirror must add seven packages. The README spells out the one-line install; npm 7+ reports missing peers loudly.
- **Version drift.** A host on a much older `@codemirror/view` than Stylo was built against could hit a missing export. The `^6.0.0` floor is deliberate but wide; if a real incompatibility surfaces, raise the floor in the same commit that works around it.
- CI must keep proving the floor works — the `react18` job already does this for React; a CodeMirror-floor job can be added if drift ever bites.

## Alternatives rejected

- **Keep bundling CodeMirror.** Simplest to install, but the dual-package hazard is a silent correctness bug for exactly the consumer Stylo is being packaged for. Non-starter.
- **Bundle, but dedupe via the host's bundler** (`resolve.dedupe`, import maps). Pushes a CodeMirror-specific workaround onto every consumer's build config and fails for anyone consuming the pre-built `dist/` without a bundler pass.
- **Peer-depend on `@codemirror/state` and `@codemirror/view` only**, bundle the rest. `@codemirror/language` carries the `language` / `syntaxTree` facets and `@codemirror/lang-markdown` the parser — both identity-sensitive the moment a host reads the tree, which Stylo's own docs tell hosts to do. Half-measure.
- **A single `codemirror` meta-package peer.** The `codemirror` umbrella pins specific sub-package versions and pulls in `@codemirror/autocomplete`, `@codemirror/search`, `@codemirror/lint` that Stylo never touches. Listing the five packages actually imported is leaner and lets the host's ranges win.
- **Make `katex` a peer too.** Consistency argument, but KaTeX has no identity contract to break — a second copy is a size cost only, and few React apps already ship KaTeX. Not worth the install friction.
