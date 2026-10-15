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

# 015 — Split `Stylo.tsx` under the 200-line ceiling

Accepted by the owner on 2026-10-15, with both extractions, and with the four other files over the ceiling left out of scope.

> **Summary.** Move the imperative handle into a hook, `useStyloHandle`, and the toolbar's derivation and render into a component, `StyloToolbar`, so `src/Stylo.tsx` falls from 245 lines to about 170 and a new prop no longer pushes it over. Behaviour and the public API do not change. It costs two new modules and one more place to look for what `Stylo` does.

## Context

- `CONTRIBUTING.md` sets "a hard ceiling of 200 lines" for source files in `src/`, and `CLAUDE.md` repeats it. Nothing enforces it: no gate counts lines.
- `src/Stylo.tsx` is 245 lines, counted on 2026-10-15. It was 234 before `imageSource` (0.23.0) added a prop, a ref and a handle method; it was already over. The handoff has listed it as waiting on the owner.
- It is not the only file over: `src/inplace/table-widget.ts` is 425, `src/types/core.ts` 234, `src/inplace/theme-canvas.ts` 225 and `src/toolbar/inline-ops.ts` 207. This record covers `Stylo.tsx` only.
- What is in it, by size: the prop list and its pass-through to four surfaces (about 110 lines, which grows by roughly four lines for every new prop that reaches a surface); the imperative handle, with its two source refs (about 50 lines, and the only logic that is not wiring); the toolbar derivation and render (about 30 lines, an immediately invoked function that builds the bar and hands it to a host `render`); the frontmatter report and the resolve-error wrapper (about 20 lines each).
- The handle is covered by `test/imperative.test.tsx`, which drives it through `Stylo` and a ref. The toolbar is covered through `Stylo` in the toolbar tests. Neither test imports a moved symbol, so neither needs to change.

## Decision

1. **Add `src/useStyloHandle.ts`.** A hook `useStyloHandle(ref, view, { embedSource, imageSource })` that owns the two source refs, the `useImperativeHandle` call, and the handle's methods, moved as they are. `scrollToHeading` stays inside it, as a plain function above the hook, so it can be read and tested alone later. `Stylo` calls it once.
2. **Add `src/toolbar/StyloToolbar.tsx`.** A component taking `view`, `toolbar`, `icons`, `readOnly` and `hidden`, which resolves the items, derives the sticky and overflow values, builds `<Toolbar>` and applies a host's `render`. It returns `null` when `hidden` (the `preview` mode) or when the config resolves to no items. `Stylo` keeps one thing the toolbar needs from the same config: whether the root takes the sticky class, so a small exported helper in the same file, `stickyEdge(toolbar)`, returns `"top"`, `"bottom"` or `false` and is used by both.
3. **Leave the rest in `Stylo.tsx`.** The prop list and the four surface branches are wiring that reads best in one place. The frontmatter report and the resolve-error wrapper are each about a dozen lines and tied to `Stylo`'s own refs, so they stay.
4. **No behaviour change, no new dependency, no new export.** `src/index.ts` is untouched; the two modules are internal. The slice carries no test change beyond whatever a moved import breaks, and the gates prove it: the whole suite, the browser suite, the typecheck and the bundle-size check must pass as they stand, with the size budgets unchanged.
5. **Closing the slice** adds a journal note and, in the wiki, the one line in the architecture page that says where the handle and the toolbar live. The handoff line about the 245 lines goes.

## Consequences

- **Easier.** `Stylo.tsx` reads as props in, surfaces out. A new prop costs the four pass-through lines and nothing else, with about 30 lines of headroom. The handle can be tested without mounting a surface, if it ever needs to be.
- **Harder.** Two more files for someone to open when a toolbar or handle bug turns up; `Stylo` no longer shows the whole of its job on one screen. The handle hook takes the view and the two sources as arguments, so a new handle method that needs another prop widens that signature.
- **No effect on consumers.** The public surface and the rendered output are the same. The bundle should move by a few bytes of module overhead; `npm run check:size` decides, and a budget is raised only with a reason.
- **Left open.** The four other files over the ceiling, and the lack of a gate. A gate that fails a file over 200 lines needs an allowlist for those four on day one, which is its own decision.

## Alternatives rejected

- **Raise the ceiling for `Stylo.tsx`, or for all of `src/`.** Cheapest, and the file is mostly wiring, but the ceiling is the owner's rule and one exception invites the next four. Becomes right if the owner decides wiring files are exempt, in which case say so in `CONTRIBUTING.md`.
- **Move only the handle.** Takes the file to about 195, which a single new prop undoes. Becomes right if the toolbar block is expected to change shape soon, since it would move again.
- **Group the surface props into one object passed to each view** (`const shared = { value, onChange, ... }`). Shrinks the pass-through the most, but it loosens the typing of each view's props, hides which surface takes which prop, and is a new abstraction nobody asked for. Becomes right if a fifth surface is added.
- **Split by mode into four small components (`SourceMode`, `PreviewMode`, ...).** Each surface already is a component; this would add a layer that only forwards props. Not worth the indirection at four modes.
- **Add the line-count gate in the same change.** Right in the end, but it forces a decision on the four other files now. Kept separate.

## Amendment (2026-10-15): what the build settled

- **`Stylo.tsx` is 184 lines, not about 170.** `src/useStyloHandle.ts` is 64 lines and `src/toolbar/StyloToolbar.tsx` 39. The headroom is 16 lines, about four new props, not 30.
- **The split is as decided, with `scrollToHeading` a function of `(view, text)` above the hook,** so the handle method is a one-line call into it.
- **The bundle moved a little, and one chunk changed its name.** `stylo.js` grew from 5,738 B to 5,788 B gzip (budget 6,000 B). The shared chunk of toolbar glyphs, labels and item config is the same code, but the bundler names a chunk after one of its modules, and with `StyloToolbar` importing the icons first it is now `icons-*.js` instead of `config-*.js`. The size script matches budgets by name, so its entry `config` (3,000 B) became `icons` (3,000 B); the limit did not change. The name can flip again if the import order changes, and the script's failure on an unbudgeted chunk says so.
