---
title: "Frontmatter as a raw callback"
created: 2026-09-04
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Frontmatter as a raw callback

## Context

ADR-001 deferred exposing parsed frontmatter "to its own decision." An integration review made the case concrete: a consumer's panel renders a structured title / date / tags card from the leading `---` block, and Stylo could only hand back a raw `<div>` in `preview`, or nothing at all in the editing modes. The options were a callback with the raw text (host parses) or a bundled key/value parser.

## Decision

Raw text, no parser — recorded as the 2026-09-04 amendment to ADR-001. Parsing YAML is a policy the host owns (schema, date coercion, `!!` tags, multi-document streams); a bundled parser would be the compose-don't-adopt line crossed for frontmatter the same way ADR-001 refused it for the editing surface. A minimal flat parser stays a possible future (revisit trigger: three consumers hand-rolling the same one); a full YAML dependency stays rejected.

## What was built

**`onFrontmatter?: (raw: string | null) => void`** on `<Stylo>`. A `useEffect` in `Stylo.tsx` runs `splitFrontmatter(value)` on mount and on every `value` change, compares the inner text to a ref, and calls the handler only when it differs — so a body-only edit does not fire it. `raw` is the text between the fences (`""` for an empty block), or `null` when there is no block. Works in every mode, since it is driven by `value`, not the editor view.

**`splitFrontmatter(md)`** is now re-exported from the package entry, for the same split synchronously: `{ frontmatter, body } | null`.

Neither path parses anything. The documented pattern is `import YAML from "yaml"; const data = YAML.parse(raw)` on the consumer side.

## Verification

`typecheck`, **297 Vitest tests** (5 new in `test/frontmatter-callback.test.tsx` — fires once on mount, fires with `null` when absent, fires on a frontmatter edit but not a body-only edit, fires `null` on removal, and `splitFrontmatter` slicing), `build`, `check:theme`, `check:size`, and `format:check` pass. No new dependency.

## Follow-ups

- A `parsed` second argument once (if) a minimal built-in parser lands.
- An in-place "properties" panel display mode — still tracked in the in-place canvas notes, still gated on this same no-YAML-dep line.
