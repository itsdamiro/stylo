---
type: decision
status: accepted
date: 2026-10-15
projects: [stylo]
concepts: [Host integration]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 016 — A line-count gate with a shrink-only allowlist

Accepted by the owner on 2026-10-15 as written: CSS out of scope, a file of exactly 200 lines passes, and the allowlist shrinks only.

> **Summary.** A new gate, `npm run check:lines`, fails any `.ts` or `.tsx` file in `src/` over 200 lines, except nine files held at their current length in a list that can only shrink. It makes the ceiling in `CONTRIBUTING.md` something a change cannot cross unnoticed. It costs one script, one line in the checklist and CI, and a list of nine files to work off.

## Context

- `CONTRIBUTING.md` sets "a hard ceiling of 200 lines" for source files in `src/`; the project rules repeat it. Nothing checks it. `Stylo.tsx` went over by one prop at a time and was found by reading ([ADR-015](015-split-stylo-tsx-under-the-ceiling.md)).
- A count of the `.ts` and `.tsx` files in `src/` on 2026-10-15 (`wc -l`) finds nine over 200: `table-widget.ts` 425, `types/core.ts` 234, `theme-canvas.ts` 225, `inline-ops.ts` 207, `StyloToolbarSettings.tsx` 204, `command-helpers.ts` 202, `context-menu-actions.ts` 202, `context-menu.ts` 201 and `table-cell-marks.ts` 201. Six more sit at 191 to 199.
- `src/` also holds three CSS files, one of them 709 lines (`styles/stylo.module.css`) and one at exactly 200. The ceiling's wording is "source files", and every code file it has been applied to is TypeScript.
- Stylo's other checks are small Node scripts wired as `npm run check:*` (`check:theme`, `check:size`, `check:package`), run by CI and listed in `scripts/gates.conf`. `check-bundle-size.mjs` already holds a per-chunk table of limits in the script.
- The rule's wording differs in two places: "a hard ceiling of 200 lines" and "stay under 200". This record takes the first: a file of exactly 200 lines passes.

## Decision

1. **Add `scripts/check-line-count.mjs` and `npm run check:lines`.** It walks `src/` for `.ts` and `.tsx` files, counts lines as `wc -l` does (the newline-terminated lines), and exits 1 listing every failure. No dependency; Node's standard library only.
2. **A file over 200 lines fails,** unless it is in the allowlist, a table at the top of the script mapping a path to the length it may not exceed. The nine files above start at their current lengths.
3. **The list only shrinks.** A listed file that grows past its entry fails. A listed file at 200 lines or fewer also fails, with a message to delete its entry, so a fixed file cannot quietly fall back. An entry for a file that no longer exists fails too. Raising an entry is not a supported move: the answer to a failure is to split the file.
4. **Tests, the playground and generated files are out of scope.** The gate looks only at `src/`. CSS is out of scope for now (see Alternatives rejected).
5. **Wire it in the places the other checks are:** a line in `scripts/gates.conf` after `theme`, a step in `.github/workflows/ci.yml` beside `check:theme`, and the verify list in the "Making changes" section of `CONTRIBUTING.md`, which also says what the allowlist is.
6. **Working the list off is not part of this record.** Each file is split in a slice of its own, which deletes its entry; the first to take is the smallest overruns, where a few lines move out.
7. **Proof the gate works** is two runs recorded in the journal: it passes on the tree as it stands, and it fails when a listed file grows by a line, when an unlisted file passes 200, and when a listed file is brought to 200 or fewer.

## Consequences

- **Easier.** A change that pushes a file over 200 lines fails in the gates and in CI, with the file named, before review. The ceiling stops depending on someone noticing.
- **Harder.** A change that touches one of the nine files cannot add a line to it, even for a one-line fix; it has to take a line out elsewhere in the file or split it first. That is the point, and it will cost something for `table-widget.ts` especially.
- **A stale list is loud, not silent.** Splitting a file without deleting its entry fails the gate, so the list cannot rot.
- **The gate counts lines, not complexity.** A 199-line file can still do three things; the rule is the owner's proxy for "one responsibility" and the gate holds only the proxy.
- **Left open.** The nine splits; whether the 200-line rule covers CSS; and the six files at 191 to 199, which the gate does not warn about.

## Alternatives rejected

- **No allowlist: fail on all nine at once.** The gate would be red on arrival and nobody could merge until nine splits land. Becomes right if the nine are split first, and then the list is empty and can go.
- **A flat allowlist with no length per file.** Simpler, but a listed file could grow without limit, the one thing the gate is for. Becomes right never; the recorded length is one number.
- **A warning at 191 and above.** Early notice, but a gate that warns is read once and ignored. Becomes right if files are seen crossing from nowhere, in which case a separate non-failing report is the form.
- **An ESLint `max-lines` rule.** The project has no ESLint; adding it for one rule is a new dependency against the zero-bloat rule. Becomes right if ESLint arrives for another reason.
- **Count CSS too.** `stylo.module.css` at 709 lines would need its own split plan and an entry on day one, and the rule's intent is about modules. Becomes right if the owner says the ceiling covers stylesheets, as a follow-up record.
- **Count tests.** A spec that walks a long scenario is often long for a reason, and the rule names `src/`. Becomes right only if a test file's length starts to hurt.
- **Do the nine splits first, then add the gate.** Cleaner end state, but the same slip happens again in the weeks it takes. Kept as the follow-up order instead, with the gate holding the line meanwhile.
