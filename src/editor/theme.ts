import { EditorView } from "@codemirror/view"

/** CodeMirror theme wired to the `--stylo-*` tokens so the host controls the palette. */
export const styloTheme = EditorView.theme({
  "&": {
    color: "var(--stylo-text)",
    backgroundColor: "var(--stylo-bg)",
    fontSize: "var(--stylo-font-size, 0.9375rem)",
  },
  ".cm-content": {
    fontFamily:
      "var(--stylo-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)",
    padding: "0.75rem 0",
    caretColor: "var(--stylo-text)",
  },
  ".cm-line": {
    padding: "0 0.75rem",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--stylo-text)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in srgb, var(--stylo-accent) 15%, transparent)",
  },
  ".cm-placeholder": {
    color: "var(--stylo-text-muted)",
  },
  // Stylo configures no gutter of its own, so this only styles one a host adds
  // through the `extensions` prop.
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--stylo-text-muted)",
    border: "none",
  },

  // --- Find / replace panel (@codemirror/search) ---
  // Stylo supplies its own panel via `createPanel` (see `search-panel.ts` /
  // `search-panel-dom.ts`) instead of restyling the library's fixed markup, so the DOM
  // is already built in the order it reads: find | next/prev/all | replace |
  // replace/replace all | match case/regexp/by word | close — no `order` reshuffle
  // needed, and Tab now follows that same layout. Docked at the top (see
  // `extensions.ts`), styled to read as one more row of the existing toolbar rather
  // than a separate floating card.
  ".cm-panels": {
    color: "var(--stylo-text)",
  },
  ".cm-panels.cm-panels-top": {
    background: "var(--stylo-bg)",
  },
  ".stylo-search-panel": {
    "--h": "32px",
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: "4px",
    height: "var(--h)",
    boxSizing: "border-box",
    padding: "0 8px",
    overflowX: "auto",
    overflowY: "hidden",
    font: "inherit",
    fontSize: "0.75rem",
    borderBottom: "1px solid var(--stylo-border)",
    animation: "stylo-search-slide-in 0.16s ease-out",
  },
  ".stylo-search-panel.cm-search-closing": {
    animation: "stylo-search-slide-out 0.16s ease-in forwards",
  },
  "@keyframes stylo-search-slide-in": {
    from: { height: "0px" },
    to: { height: "var(--h)" },
  },
  "@keyframes stylo-search-slide-out": {
    from: { height: "var(--h)" },
    to: { height: "0px" },
  },
  ".stylo-search-check": {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    whiteSpace: "nowrap",
    fontSize: "0.6875rem",
    color: "var(--stylo-text-muted)",
    flex: "0 0 auto",
  },
  ".stylo-search-field": {
    flex: "1 1 90px",
    minWidth: "60px",
    padding: "0.2em 0.4em",
    border: "1px solid var(--stylo-border)",
    borderRadius: "calc(var(--stylo-radius) - 3px)",
    background: "var(--stylo-bg)",
    color: "var(--stylo-text)",
    fontSize: "0.75rem",
  },
  ".stylo-search-field:focus-visible": {
    outline: "2px solid var(--stylo-ring)",
    outlineOffset: "-1px",
  },
  ".stylo-search-field.stylo-search-replace": {
    marginLeft: "6px",
    paddingLeft: "10px",
    borderLeft: "1px solid var(--stylo-border)",
    borderRadius: "0",
  },
  // Text-only, no borders — mirrors `.toolbarButton` so the row stays
  // borderless and short enough to fit one line at toolbar height.
  ".stylo-search-button": {
    flex: "0 0 auto",
    padding: "0.15em 0.4em",
    border: "0",
    borderRadius: "calc(var(--stylo-radius) - 3px)",
    background: "none",
    backgroundImage: "none",
    color: "var(--stylo-text-muted)",
    fontSize: "0.6875rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  ".stylo-search-button:hover": {
    background: "color-mix(in srgb, var(--stylo-border) 45%, transparent)",
    color: "var(--stylo-text)",
  },
  ".stylo-search-close": {
    marginLeft: "auto",
    color: "var(--stylo-text-muted)",
    fontSize: "0.9rem",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, var(--stylo-ring) 35%, transparent)",
    borderRadius: "2px",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, var(--stylo-ring) 70%, transparent)",
    outline: "1px solid var(--stylo-ring)",
  },
})
