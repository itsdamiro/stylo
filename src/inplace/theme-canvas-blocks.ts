/**
 * The block-level half of the in-place canvas's prose styling: math blocks,
 * embeds, rules, plain blockquotes, lists and frontmatter. Spread into
 * `canvasTheme` (`theme-canvas.ts`), which holds the typography half.
 */

import { MONO, SANS } from "./theme-fonts"

export const canvasBlockTheme = {
  ".cm-inplace-math-block": {
    display: "block",
    padding: "0.9em 0",
    textAlign: "center",
  },
  ".cm-inplace-math-block .katex-display": { margin: "0" },

  // The inert slot an `![[ref]]` embed renders into; the host node is portalled
  // in by `InPlaceView`. Block flow, a little breathing room, and the shared
  // `--stylo-embed-accent` edge so a canvas embed matches the `preview` one.
  // Padding, not margin — same rule as the block/rule/table/math block above:
  // margin sits outside the border box CodeMirror's height map measures, so it
  // drifts click-to-position for every line below the embed. (Padding here
  // used to also break interactive host content — clicking a button inside
  // the embed revealed raw source instead of reaching it. Root cause:
  // CodeMirror's *own* built-in mousedown handling runs in the same handler
  // list as `extension.ts`'s custom one, so that handler returning `false`
  // for embed content only skips its own logic, not CodeMirror's default
  // click-to-place-caret — which the padding change apparently tipped into
  // resolving inside the atomic range. Fixed at the source instead:
  // `Embed.tsx` now stops mousedown propagation on `.stylo-embed-content`
  // itself, the same technique the editable table widget already used for
  // the identical problem, so the event never reaches CodeMirror's listener
  // at all — regardless of this element's own box model.)
  ".cm-inplace-embed": {
    display: "block",
    padding: "0.9em 0",
  },
  ".cm-inplace-embed .stylo-embed-content": {
    borderLeft: "3px solid var(--stylo-embed-accent, var(--stylo-border))",
    paddingLeft: "1rem",
  },
  // A host node with its own `margin-top` / `margin-bottom` (a self-styled
  // card, say) collapses that margin straight through `.stylo-embed-content` —
  // it carries no vertical padding/border of its own to stop it — so the
  // border-left rail (drawn at `.stylo-embed-content`'s own box edge) ends up
  // not matching where the card actually renders. `preview`'s stylesheet
  // already zeroes this (`stylo.module.css`); the canvas theme never got the
  // same rule when embeds landed here.
  ".cm-inplace-embed .stylo-embed-content > :first-child": { marginTop: "0" },
  ".cm-inplace-embed .stylo-embed-content > :last-child": { marginBottom: "0" },
  // A `![[ref]]` mid-sentence: flows inline, no box — the host node carries its
  // own presentation, and `.stylo-embed-inline` is the consumer hook.
  ".cm-inplace-embed-inline": { display: "inline" },

  // The `---` line's own text row is zeroed (same recipe as the fenced-code
  // fence rows) so it does not stack under the widget's height — that stacking
  // was the extra space above and below the rule.
  ".cm-inplace-hr-line": { fontSize: "0", lineHeight: "0" },
  // A Setext heading's `===` / `---` underline row, collapsed to nothing off
  // the caret so the heading reads as one line (the `---` text is also hidden).
  ".cm-inplace-setext-rule": { fontSize: "0", lineHeight: "0" },
  ".cm-inplace-hr": {
    display: "block",
    // ~one text row, so the rule renders in the `---`'s own footprint with no
    // extra space and no shift when the caret enters (Obsidian's behaviour).
    // `rem` not `em` because the line's font-size is zeroed above. No margin,
    // so CodeMirror's height map measures it right (2026-09-02 click-mapping).
    height: "1.6rem",
    margin: "0",
    border: "none",
    // A 1px hairline painted at the row's centre line.
    background:
      "linear-gradient(var(--stylo-border), var(--stylo-border)) left center / 100% 1px no-repeat",
  },
  ".cm-inplace-quote": {
    borderLeft: "0.25rem solid var(--stylo-border)",
    // Same content inset as a callout, so a quote and a callout line up.
    paddingLeft: "1rem",
    color: "var(--stylo-text-muted)",
  },

  ".cm-inplace-bullet": { color: "var(--stylo-text-muted)" },
  // Nested-list indent guides: `--sl-li-depth` 1px rules, one per level above
  // this line, spaced by an indent step and clipped to that width. Approximate
  // alignment — decorative depth cue, not a pixel-exact rail.
  ".cm-inplace-li": {
    backgroundImage:
      "repeating-linear-gradient(to right, var(--stylo-guide) 0 1px, transparent 1px 1.5em)",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "0.35em 0",
    backgroundSize: "calc(var(--sl-li-depth, 0) * 1.5em) 100%",
  },
  // Gap above every list item but the first in its own list — a flat text
  // canvas has no `<li>` box to hang a margin on, so this is `list-guides.ts`'s
  // approximation of preview's `li` / `li > :is(ul, ol)` margins, matching its
  // spacing between items rather than its box model (2026-09-13).
  ".cm-inplace-item-gap": { paddingTop: "var(--stylo-rhythm-list-item-gap, 0.5em)" },
  ".cm-inplace-item-gap-nested": { paddingTop: "var(--stylo-rhythm-list-item-gap-nested, 0.75em)" },
  ".cm-inplace-checkbox": {
    margin: "0 0.4em 0 0",
    verticalAlign: "middle",
    cursor: "pointer",
  },
  ".cm-inplace-fm": {
    fontFamily: MONO,
    fontSize: "0.85em",
    color: "var(--stylo-text-muted)",
  },
  ".cm-inplace-fm-first::before": {
    content: '"Frontmatter"',
    marginRight: "0.6em",
    fontFamily: SANS,
    fontSize: "0.8rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--stylo-text-muted)",
  },
}
