# Contributing to Stylo

Stylo is a plain-text-first Markdown editor for React with first-class LaTeX (KaTeX) support. It is a small, reusable component library that other projects install, so every change is weighed against the cost it imposes on consumers.

---

## Engineering principles

- **Simplicity first.** Prefer the most direct solution with the fewest moving parts. Resist premature abstraction.
- **One responsibility per module.** Keep source files in `src/` focused and small — a **hard ceiling of 200 lines**. Split a module when it grows past that. The public entry point (`src/index.ts`) stays a thin barrel: re-exports and types only, no logic.
- **Zero-bloat dependencies.** Do not add a dependency, library, or build tool unless it is genuinely necessary. Every dependency must be modular, tree-shakeable, and MIT-compatible. Any addition must be justified in an ADR with an **Alternatives rejected** section weighing it against at least one lighter option. Precedent: Tailwind and `lucide-react` were both rejected for the internal UI in favour of CSS Modules and inline SVG (see ADR-002).

## Architecture invariants

- **Plain text is canonical.** `<Stylo>`'s value is a Markdown string. There is no intermediate document model that must be serialized back. See [ADR-001](./docs/decisions/001-editor-architecture.md).
- **Lossless round-trip.** YAML frontmatter, `[[wikilinks]]`, and `$…$` / `$$…$$` math must survive a full edit cycle unchanged and stay editable by Obsidian and other plain-Markdown tools.
- **Compose from primitives.** CodeMirror 6 for the editing surface; `remark` / `rehype` + KaTeX for rendering. Do not adopt a ProseMirror- or Lexical-style editor framework.
- **CodeMirror and Lezer stay peer dependencies.** They are externalised from the bundle so the host's copy is the only copy — a new `@codemirror/*` or `@lezer/*` import must be added to both `peerDependencies` and `devDependencies`, never to `dependencies`. See [ADR-008](./docs/decisions/008-codemirror-peer-dependency.md).
- **Design tokens are introduced against the in-place canvas, and `preview`'s reach is decided in the same change.** A new `--stylo-*` token targets the in-place canvas first. Before it ships, its applicability to `preview` (and `split`, which is just `source` + `preview` side by side) must be recorded — either wired in too, or the amendment says why not. Silence is what let `--stylo-font-size` and the `--stylo-syntax-*` set reach the in-place canvas only, unnoticed, for days. See ADR-002 §3's 2026-09-13 amendment.

## Making changes

- Touch only the lines and files necessary for the change at hand.
- Discuss scope before large or architectural changes — open an issue or a draft ADR first.
- Verify before opening a PR: `npm run format:check`, `npm run check:theme`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run check:size` must all pass. CI runs the same set, plus a React 18 and a TypeScript-6 job against the peer/consumer floor, `npm run check:package`, and the two Markdown checks (`scripts/md_wrap_check.py`, `scripts/adr_check.py`).
- `npm run check:package` packs the tarball, installs it into a throwaway consumer, and runs `tsc` + `vite build` against it — so a broken `exports` map, a missing `.d.ts`, an accidental hard dependency, or a React-19-only type in the shipped types fails locally instead of in a downstream project. The consumer fixture lives in `scripts/consumer/`. Run it after any change to `package.json` `exports`, the build config, or the public type surface.
- `npm run test:browser` (Playwright, in `test/browser/`) covers the in-place canvas in a real Chromium — marker reveal, popup positioning, the sticky toolbar, KaTeX. It needs the browser once (`npx playwright install chromium`); CI runs it in its own job. Touch it when a change affects layout or pointer / caret interaction that jsdom can't exercise.
- If something fails or stalls, find the root cause rather than working around it.

---

## Documentation standards

Whenever an architectural subsystem or core feature is introduced or modified, document it synchronously across two layers.

### Wiki (`docs/wiki/`)

Concept-based, publication-ready documentation (Quartz / Docusaurus / Obsidian Publish). Subfolders: `architecture/`, `guides/`, `reference/`, with `docs/wiki/index.md` as the navigation map. Include the systems rationale — why a decision was made, benchmarks, gotchas — and Mermaid diagrams for data flow. The wiki is present-tense: it always describes how the system works now.

### Engineering journal (`docs/journal/YYYY-MM/`)

Chronological log of milestones.

- Monthly date folders: `docs/journal/YYYY-MM/`.
- Filename format `YYYY-MM-DD_topic-slug.md`.
- The master index lives in `docs/PROJECT_JOURNAL.md`, newest first.

### Decision records (`docs/decisions/`)

Formal Architectural Decision Records, one file per decision, written before the code (steps: `docs/sop/write-an-adr.md`).

- Filename `NNN-short-slug.md`, numbered on from the last record, written from `docs/decisions/TEMPLATE.md`. The index is `docs/decisions/README.md`, and `scripts/adr_check.py` (a gate) checks the shape.
- Records 001 to 012 were journal entries until [ADR-013](./docs/decisions/013-adr-records-live-in-docs-decisions.md) moved them here.

**ADR content standard.** Every ADR carries, in order: a **Summary**, **Context**, **Decision**, **Consequences** (both positive and negative / costs), and **Alternatives rejected**; the **Status** and **Date** live in the frontmatter. The rejected-alternatives section is mandatory — name each option that was genuinely on the table and why it lost. An ADR without it is a proposal, not a decision record.

**Scope discipline.** When an ADR covers a feature set, split it into _"Accepted for the first release"_ and _"Deferred (post-v1, additive)"_. Deferred items must not gate the first release. If a decision is time-boxed for re-evaluation (a browser capability maturing, an ecosystem stabilising), record the revisit trigger explicitly.

**Amendment & supersession.** A change to an implemented decision is a dated `## Amendment (YYYY-MM-DD): title` section at the end of the same record; the decision text stays current. A change of course that reverses a record is a **new** record with `supersedes: [NNN]`, and the old record's status becomes `superseded` with a link forward. Never silently edit an earlier record's body to match.

**Index & cross-reference sync.** Adding or amending an ADR is not complete until, in the same change: its row in `docs/decisions/README.md` is added or updated; and every wiki page whose content derives from the decision links to the ADR and reflects its current state.

### Obsidian YAML frontmatter

Every file under `docs/` begins with valid Obsidian YAML frontmatter. Root meta files (`README.md`, `CONTRIBUTING.md`, `LICENSE`) are exempt.

```yaml
---
title: "Article Title"
created: YYYY-MM-DD
type: wiki-architecture # wiki-architecture | wiki-guides | wiki-reference | journal | adr
parent: index
tags:
  - stylo/architecture
  - engineering/adr
---
```

Use a controlled tag vocabulary; do not invent per-file variants:

| Content                          | Tags                                         |
| -------------------------------- | -------------------------------------------- |
| Wiki — architecture              | `stylo/architecture`, `engineering/standard` |
| Wiki — guides / reference / home | `stylo/wiki`, `engineering/standard`         |
| Journal milestone                | `stylo/journal`, `engineering/milestone`     |

### Portfolio-safe contents

The journal, ADRs, and wiki are committed and published. Keep their contents generic: generic file, directory, and repository references; no credentials, private URLs, or internal-only context. Write every entry as if a reviewer will read it.

---

## Repository conventions

- **The repository stays vendor-neutral.** Editor-specific and local workspace configuration — e.g. `.vscode/`, `.cursor/`, `.agents/` — is `.gitignore`d and never committed. Standards that belong to the project live here and in `docs/`.
- **Commit messages**: imperative subject, prefixed by area (`docs:`, `feat:`, `fix:`, `chore:`). Explain the _why_ in the body.
- **Branches**: work on a topic branch off `main`; open a PR.

## Repository hygiene

These are strict, not aspirational.

- **Single author identity.** Every commit is authored and committed by the repository owner, `damiro <hello.damiro@gmail.com>` — no secondary identities, no aliases. History is kept that way with `git filter-repo --mailmap`; a machine committing under a different name or email is misconfigured. Prefer merging PRs locally (`git merge --ff-only` then `git push`) so the merge commit carries the same identity.
- **No trailers.** Commits carry no `Co-authored-by`, `Signed-off-by`, or any tooling or attribution trailer.
- **Editor and workspace tooling is never committed.** Local editor and workspace configuration is `.gitignore`d here and, machine-wide, through `core.excludesFile` (`~/.gitignore_global`). The repository ships only its own source, docs, and build configuration.

## Commands

Vite in library mode; TypeScript emits the declarations.

| Task                 | Command                 |
| -------------------- | ----------------------- |
| Dev / playground     | `npm run dev`           |
| Format               | `npm run format`        |
| Check formatting     | `npm run format:check`  |
| Theme-token guard    | `npm run check:theme`   |
| Typecheck            | `npm run typecheck`     |
| Run tests            | `npm run test`          |
| Browser tests        | `npm run test:browser`  |
| Build library bundle | `npm run build`         |
| Bundle-size guard    | `npm run check:size`    |
| Packaging smoke      | `npm run check:package` |

## Releasing

Pre-1.0, so every release may carry breaking changes; bump the **minor** for features and breaks, the **patch** for fixes only.

1. `npm run format:check && npm run check:theme && npm run typecheck && npm run test && npm run build && npm run check:size && npm run check:package`.
2. Give the pending `CHANGELOG.md` section a `## [x.y.z] - YYYY-MM-DD` heading and add the release link at the bottom.
3. Bump `version` in `package.json`.
4. Commit as `chore: release x.y.z`, then `git tag vx.y.z` and push the tag.
5. `npm publish` (the `prepare` script builds `dist/` first). Until the first publish, consumers install from git and `prepare` builds on their machine.
