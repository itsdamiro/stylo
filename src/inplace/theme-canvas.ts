/**
 * The prose display styling for the in-place canvas proper: base typography,
 * headings, inline marks, code and links. The block-level rest (math, embeds,
 * rules, plain blockquotes, lists, frontmatter) is `theme-canvas-blocks.ts`,
 * spread in at the end. Callout blockquotes are their own file
 * (`theme-callout.ts`). Split out of `theme.ts`, which spreads this together
 * with the callout / table / menu / popup sections into one `EditorView.theme`
 * call.
 */

import { canvasBlockTheme } from "./theme-canvas-blocks"
import { MONO, SANS } from "./theme-fonts"

export const canvasTheme = {
  // The canvas reads as prose, not source. Code spans opt back into monospace.
  //
  // The horizontal gutter lives here, not on `.cm-line`. A `.cm-line` padding
  // insets its text but not a line background/border (CSS paints those across
  // the padding too) nor a block widget (a `block: true` replacement renders
  // outside `.cm-line`). So a boxed block — fenced code, the blockquote bar, a
  // rendered table, a `$$` math block — would otherwise bleed to the editor
  // frame. Padding on `.cm-content` holds every one of them off the edge.
  "& .cm-content": {
    fontFamily: SANS,
    lineHeight: "1.75",
    padding: "0.75rem",
    // Suppress iOS Safari's own long-press callout so it stops racing (and
    // usually beating) the canvas's long-press → context-menu gesture. Text
    // selection and the selection handles are unaffected.
    WebkitTouchCallout: "none",
  },
  "& .cm-line": { paddingLeft: "0", paddingRight: "0" },

  ".cm-inplace-heading": { fontWeight: "600" },
  // Sizes and line-heights come from the same --stylo-rhythm-* custom
  // properties preview reads (tokens.css) — h5/h6 previously had no
  // line-height set here at all, inheriting the canvas's own 1.75 rather than
  // matching preview's 1.5 (2026-09-13).
  ".cm-inplace-h1": {
    fontSize: "var(--stylo-rhythm-h1-size, 2.25em)",
    lineHeight: "var(--stylo-rhythm-h1-line, 1.1111111)",
    paddingTop: "0.35em",
  },
  ".cm-inplace-h2": {
    fontSize: "var(--stylo-rhythm-h2-size, 1.5em)",
    lineHeight: "var(--stylo-rhythm-h2-line, 1.3333333)",
    paddingTop: "0.7em",
  },
  ".cm-inplace-h3": {
    fontSize: "var(--stylo-rhythm-h3-size, 1.25em)",
    lineHeight: "var(--stylo-rhythm-h3-line, 1.6)",
    paddingTop: "0.6em",
  },
  ".cm-inplace-h4": {
    fontSize: "var(--stylo-rhythm-h4-size, 1em)",
    lineHeight: "var(--stylo-rhythm-h4-line, 1.5)",
    paddingTop: "0.5em",
  },
  ".cm-inplace-h5": {
    fontSize: "var(--stylo-rhythm-h5-size, 0.9em)",
    lineHeight: "var(--stylo-rhythm-h5-line, 1.5)",
  },
  ".cm-inplace-h6": {
    fontSize: "var(--stylo-rhythm-h6-size, 0.9em)",
    lineHeight: "var(--stylo-rhythm-h6-line, 1.5)",
    color: "var(--stylo-text-muted)",
  },

  ".cm-inplace-strong": { fontWeight: "700" },
  ".cm-inplace-em": { fontStyle: "italic" },
  ".cm-inplace-strike": { textDecoration: "line-through" },
  ".cm-inplace-code": {
    fontFamily: MONO,
    fontSize: "0.9em",
    padding: "0.1em 0.35em",
    borderRadius: "3px",
    background: "color-mix(in srgb, var(--stylo-border) 45%, transparent)",
  },

  // Fenced / indented code block rows. The background runs the full line width
  // and the text is inset by `0.9rem`, mirroring the preview surface's `pre`
  // (`stylo.module.css`) so a block lines up with the prose column on both
  // edges. No horizontal margin — that inset the background and read as a
  // floating, too-narrow block against every other flush block.
  ".cm-inplace-mono": {
    fontFamily: MONO,
    fontSize: "0.9em",
    background: "color-mix(in srgb, var(--stylo-border) 35%, transparent)",
    padding: "0 0.9rem",
  },
  // Vertical spacing is padding, never margin, on anything CodeMirror measures
  // for its height map (`.cm-line` decorations, block/inline widgets): margin
  // sits outside the border box CM measures, so it drifts click-to-position for
  // every line below. Applies to the block, the rule, the table, and the math
  // block too.
  ".cm-inplace-code-top": {
    paddingTop: "0.7rem",
    borderTopLeftRadius: "var(--stylo-radius)",
    borderTopRightRadius: "var(--stylo-radius)",
  },
  ".cm-inplace-code-bottom": {
    paddingBottom: "0.7rem",
    borderBottomLeftRadius: "var(--stylo-radius)",
    borderBottomRightRadius: "var(--stylo-radius)",
  },
  ".cm-inplace-fence": { color: "var(--stylo-text-muted)" },
  // Off-caret fence row: no text, no height — the container is padding + code.
  ".cm-inplace-code-pad": { fontSize: "0", lineHeight: "0" },

  // Links read by colour, not underline (a standard link blue via the token).
  ".cm-inplace-link": {
    color: "var(--stylo-link)",
    textDecoration: "none",
    cursor: "pointer",
  },
  ".cm-inplace-wikilink": { color: "var(--stylo-link)" },

  ...canvasBlockTheme,
}
