# Gotchas and recipes

The durable half of the handoff: traps that have already cost time, and the exact recipe for each recurring chore. One entry per trap, each with the symptom, the cause and the fix. When an entry stops being true, delete it.

## Contents

1. Traps
2. Recipes

## 1. Traps

### A host resize that lands on the wrong box

- **Symptom:** a host sizes a rendered surface (the in-place table, `preview`'s table) and the visible content does not follow. Fixed twice already, in 0.15.1 and 0.15.2.
- **Cause:** the override reached an outer box with no link to the visible content: padding reserved in flow on one side, and `display: block` switching off the `<table>` layout algorithm on the other.
- **Do this:** measure in a real Chromium (`npm run test:browser`), not with `getBoundingClientRect()` on the outer element in jsdom. The audit is `docs/journal/2026-09/2026-09-14_table-layout-footgun-audit.md`.

### A token that reaches only the in-place canvas

- **Symptom:** a `--stylo-*` token works in the in-place canvas and silently does nothing in `preview` or `split`.
- **Cause:** tokens are introduced against the in-place canvas first, and nothing forces the other surfaces to be decided.
- **Do this:** record `preview`'s reach in the same change, wired in or with the reason it is not (the surface-parity rule, ADR-002 §3 amendment of 2026-09-13).

### A broken package that every test still passes

- **Symptom:** a consumer cannot install or type-check Stylo, although `npm run test` and `npm run build` pass.
- **Cause:** a wrong `exports` map, a missing `.d.ts`, an accidental hard dependency, or a React-19-only type in the shipped types.
- **Do this:** after any change to `package.json` `exports`, the build config or the public type surface, run `npm run check:package` (the `package` gate). It packs the tarball and builds a throwaway consumer from `scripts/consumer/`.

### A browser test that passes on a Mac and times out in CI

- **Symptom:** a Playwright spec is green locally and fails on the CI runner with a 30-second timeout in a `locator` call, waiting for something the page should have rendered. `rhythm.spec.ts` did this for at least 12 runs.
- **Cause:** a shortcut written for macOS. `Meta+A` and `Meta+V` select all and paste only there; on Linux they do nothing, so the paste never happens and the page never changes.
- **Do this:** press `ControlOrMeta+…`, which is Control on Linux and Command on macOS. A timeout that names a locator and not an assertion is usually input that never arrived, not a slow runner.

### A link that works in a checkout and is dead on GitHub

- **Symptom:** a relative link in a published document opens the file locally and 404s for anyone reading the repository on GitHub.
- **Cause:** the target is local-only and gitignored (`docs/requests/`, `docs/HANDOFF.md`), so it exists in the owner's checkout and nowhere else.
- **Do this:** name the local-only file in plain text, not as a link. `scripts/check_links.py` fails on a link to a missing file or heading; the CI `docs` job runs it on a clone, which is the only place a link into a local-only folder shows up.

## 2. Recipes

### Run the browser tests

```
npx playwright install chromium   # once per machine
npm run test:browser              # the `browser` gate, about 16 seconds
```

### Run every check the CI runs

```
scripts/gates; echo $?   # exit 0 on pass. CI adds a React 18 job and a TypeScript 6 job against the consumer floor, which the gates do not run.
```
