---
title: "Clickable task checkboxes in preview — `onTaskToggle`"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `onTaskToggle`

## Context

Filed as an upstream request: `preview` renders a GFM `- [ ]` task-list item as `<input type="checkbox" disabled>` — `remark-gfm`'s ordinary default for a read-only render, not something stylo turns on deliberately — but nothing in `PreviewProps` let a host opt out of it, the way Obsidian's reading view and GitHub's rendered Markdown both let a checkbox be clicked.

The harder half isn't dropping `disabled` — it's mapping a clicked checkbox back to the exact spot in raw `value` to flip. A DOM-order/regex-scan correlation (Nth checkbox in the DOM = Nth `- [ ]` a regex finds in `value`) was considered and ruled out: it desyncs the moment an item's own text could itself be misread as another marker, or a multi-paragraph item shifts the DOM ordinal and the regex ordinal out of step with each other. `remark-gfm` already has the real parse position for every list item; re-deriving it from outside would be strictly worse.

## Decision

A new `preview`-only prop, **`onTaskToggle`** (default `undefined` — off):

```ts
interface TaskToggleInfo {
  start: number // offset of the marker's opening `[` in `value`
  end: number //   offset just past its closing `]` (end - start === 3)
  checked: boolean // the box's new state, not its state before the click
}
onTaskToggle?: (info: TaskToggleInfo) => void
```

Implemented entirely inside `Preview.tsx`'s `components.li` override — no new remark plugin:

- `mdast-util-to-hast` gives every `<li>` the original `listItem`'s `position` (via its own `state.patch` call), even though the checkbox `<input>` it synthesizes inside gets none of its own. That's enough: the `li`'s `position.start.offset` is the exact offset of the item's own bullet or ordinal, and the checkbox marker always sits a short, anchored distance after it (`^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([ xX])\]`, in the new `src/render/taskCheckbox.ts`). Anchoring the regex to the very start of that known offset — not scanning the document for the Nth match — is what makes this safe where the DOM-order approach wasn't: there's no ordinal to keep in sync, just one item's own known start.
- The checkbox `<input>` is always the leftmost leaf under its `<li>` — `mdast-util-to-hast` unshifts it onto the first paragraph, itself the first result, whether GFM kept that paragraph wrapped (a "loose" list, blank lines between items — the `<li>` renders `<p><input>…</p>`) or unwrapped it (a "tight" one — the `<input>` sits directly in the `<li>`). A small recursive `enableLeadingCheckbox` walks only the first-element spine to find it either way, past a leading whitespace text node when there is one, without ever wandering into a nested sub-list's own checkbox (a later sibling, never a descendant of the first child).
- Once found, the `<input>` is cloned with `disabled: false` and an `onChange` reading `event.target.checked` — using `onChange` rather than `onClick` covers a keyboard-triggered toggle (Space) the same way a mouse click does, and silences React's "controlled checkbox with no change handler" warning that a bare `checked` prop would otherwise trigger.

## Consequences

- No new dependency — `remark-gfm` already parses `checked` and `position`; this only reads data it was already producing.
- `test/task-toggle.test.tsx` covers: the default (`disabled` unchanged), offsets that splice correctly for both toggle directions, a later item in a longer list mapping to its own marker rather than the first, bracket-like text inside an item's own line not confusing the anchored match, ordered (`1.`) task items, a loose list (blank line between items), and a plain (non-task) list staying untouched.
- The props reference now lists `onTaskToggle` alongside `softBreaks` as a `preview`-only, fully reactive prop, with its own "Clickable task checkboxes" section next to Embeds and Wikilink autocomplete.
