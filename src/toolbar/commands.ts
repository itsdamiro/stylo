import { redo, undo } from "@codemirror/commands"
import { searchPanelOpen } from "@codemirror/search"
import type { ToolbarCommandId } from "../types"
import { runInlineInCell } from "./cell-inline"
import {
  BULLET,
  heading,
  history,
  ORDERED,
  prefix,
  QUOTE,
  TASK,
  type ToolbarCommand,
  wrap,
} from "./command-helpers"
import {
  disabledWhen,
  inFrontmatter,
  inHeading,
  inLiteral,
  inOtherInlineLiteral,
  nothingToWrap,
} from "./command-predicates"
import { fencedCodeActive, mathBlockActive, toggleFencedCode, toggleMathBlock } from "./fence"
import { frontmatterActive, toggleFrontmatter } from "./frontmatter-toggle"
import { clearHeading } from "./heading"
import {
  linkActive,
  toggleLink,
  toggleUnderline,
  toggleWikiLink,
  toggleWrap,
  underlineActive,
  wikiLinkActive,
  wrapActive,
} from "./inline"
import { linkString, underlineString, wikiLinkString, wrapString } from "./inline-ops"
import { horizontalRuleActive, toggleHorizontalRule } from "./rule"
import { insertTable, tableActive } from "./table"
import { runSave, saveHandler } from "../editor/save"
import { toggleSearchPanel } from "../editor/search-panel"

/** Every built-in command, in a stable order. The toolbar picks from these by id. */
export const BUILTIN_COMMANDS: ToolbarCommand[] = [
  history("undo", "Undo", undo),
  history("redo", "Redo", redo),
  {
    // Calls the `onSave` prop with the document (same path as `Mod-s`).
    // Disabled — and never in the default bar — until a handler is wired.
    id: "save",
    title: "Save",
    run: (view) => {
      const ok = runSave(view)
      view.focus()
      return ok
    },
    disabled: (state) => state.facet(saveHandler) == null,
  },
  {
    // Opens or (if already open) slide-closes the find / replace panel
    // (`@codemirror/search`, see `../editor/search-panel`). `Mod-f` is bound
    // on every surface via `keys`, so the panel works without the visible
    // toolbar; the button is opt-in — not in `DEFAULT_TOOLBAR_ITEMS`. Focus
    // moves into the panel's field on open, so no `view.focus()` here.
    id: "search",
    title: "Find / replace",
    run: (view) => toggleSearchPanel(view),
    isActive: (state) => searchPanelOpen(state),
    keys: ["Mod-f"],
  },
  heading(1),
  heading(2),
  heading(3),
  {
    // The explicit "make this a paragraph again" — clearer than clicking the
    // active heading level to toggle it off.
    id: "body" as ToolbarCommandId,
    title: "Body",
    run: (view) => {
      if (!clearHeading(view)) view.focus()
      return true
    },
    isActive: (state) => !/^#{1,6} /.test(state.doc.lineAt(state.selection.main.head).text),
    disabled: disabledWhen(tableActive, inLiteral),
  },
  wrap("bold", "Bold", "**", ["Mod-b"]),
  wrap("italic", "Italic", "*", ["Mod-i"]),
  wrap("strike", "Strikethrough", "~~"),
  {
    // Markdown has no underline. This inserts a raw `<u>…</u>` HTML pair, which
    // renders wherever the host renders inline HTML. Not in the default bar —
    // add `"underline"` to `toolbar.items` to show it.
    id: "underline" as ToolbarCommandId,
    title: "Underline",
    run: (view) => runInlineInCell(view, underlineString) || toggleUnderline(view),
    isActive: underlineActive,
    disabled: disabledWhen(inLiteral, inOtherInlineLiteral("u"), nothingToWrap),
    keys: ["Mod-u"],
  },
  wrap("code", "Inline code", "`"),
  {
    // In a table cell a fenced block has no valid Markdown, so degrade to
    // inline `` `code` `` there. Disabled on a heading / in frontmatter / in a
    // `$$` block; inside a fence it is the unwrap toggle, so stays live.
    id: "codeBlock",
    title: "Code block",
    run: (view) =>
      runInlineInCell(view, (t, f, u) => wrapString(t, f, u, "`")) ||
      (tableActive(view.state) ? toggleWrap(view, "`") : toggleFencedCode(view)),
    isActive: (state) => (tableActive(state) ? wrapActive(state, "`") : fencedCodeActive(state)),
    disabled: disabledWhen(inFrontmatter, mathBlockActive, inHeading),
  },
  {
    id: "link",
    title: "Link",
    run: (view) => runInlineInCell(view, linkString) || toggleLink(view),
    isActive: linkActive,
    disabled: inLiteral,
    keys: ["Mod-k"],
  },
  {
    id: "wikilink",
    title: "Wikilink",
    run: (view) => runInlineInCell(view, wikiLinkString) || toggleWikiLink(view),
    isActive: wikiLinkActive,
    disabled: inLiteral,
    keys: ["Mod-Shift-k"],
  },
  prefix("quote", "Blockquote", QUOTE),
  prefix("bulletList", "Bulleted list", BULLET, inHeading),
  prefix("orderedList", "Numbered list", ORDERED, inHeading),
  prefix("task", "Task list", TASK, inHeading),
  {
    id: "hr",
    title: "Divider",
    run: toggleHorizontalRule,
    isActive: horizontalRuleActive,
    disabled: disabledWhen(tableActive, inLiteral),
  },
  {
    id: "frontmatter",
    title: "Frontmatter",
    run: toggleFrontmatter,
    isActive: frontmatterActive,
    // live inside the block itself (to toggle it off), disabled where it makes no sense
    disabled: disabledWhen(tableActive, fencedCodeActive, mathBlockActive, inHeading),
  },
  {
    id: "table",
    title: "Table",
    run: insertTable,
    isActive: tableActive,
    disabled: disabledWhen(
      tableActive,
      inFrontmatter,
      fencedCodeActive,
      mathBlockActive,
      inHeading,
    ),
  },
  wrap("math", "Inline math", "$"),
  {
    // In a table cell, degrade the `$$` block to inline `$…$` math. Disabled on
    // a heading / in frontmatter / in a fence; inside `$$` it is the unwrap
    // toggle, so stays live.
    id: "mathBlock",
    title: "Block math",
    run: (view) =>
      runInlineInCell(view, (t, f, u) => wrapString(t, f, u, "$")) ||
      (tableActive(view.state) ? toggleWrap(view, "$") : toggleMathBlock(view)),
    isActive: (state) => (tableActive(state) ? wrapActive(state, "$") : mathBlockActive(state)),
    disabled: disabledWhen(inFrontmatter, fencedCodeActive, inHeading),
  },
]

export const BUILTIN_BY_ID: Record<string, ToolbarCommand> = Object.fromEntries(
  BUILTIN_COMMANDS.map((c) => [c.id, c]),
)
