/**
 * The generic building blocks `context-menu-actions.ts`'s row groups are built
 * from: mapping a `ToolbarCommandId` onto a `MenuAction`, the clipboard rows,
 * and the small row/group assembly helpers.
 */

import type { EditorView } from "@codemirror/view"
import type { ToolbarCommandId } from "../types"
import { activeTableCell } from "../toolbar/cell-inline"
import { resolveForCell } from "../toolbar/command-helpers"
import { BUILTIN_BY_ID } from "../toolbar/commands"
import { ICON_PATHS } from "../toolbar/icon-paths"
import type { MenuAction, MenuRow, MenuSubmenu } from "./context-menu"

/** Menu glyph for a command id — headings share one, the rest map by id. */
export const iconFor = (id: ToolbarCommandId): string | undefined =>
  id === "h1" || id === "h2" || id === "h3" ? ICON_PATHS.heading : ICON_PATHS[id]

/** Obsidian's three grouped submenus, adapted to the commands Stylo has. */
export const FORMAT_MARK_IDS: ToolbarCommandId[] = ["bold", "italic", "strike"]
export const FORMAT_CODE_IDS: ToolbarCommandId[] = ["code", "math"]
export const PARA_LIST_IDS: ToolbarCommandId[] = ["bulletList", "orderedList", "task"]
export const PARA_HEADING_IDS: ToolbarCommandId[] = ["h1", "h2", "h3"]
export const INSERT_INLINE_IDS: ToolbarCommandId[] = ["table", "hr"]
export const INSERT_BLOCK_IDS: ToolbarCommandId[] = ["codeBlock", "mathBlock", "frontmatter"]

/**
 * `inCell`: the selection is a table cell's DOM range, not `state.selection`
 * (collapsed here) — `resolveForCell` reads the real DOM focus instead, same
 * as the toolbar does.
 */
export const toAction = (
  view: EditorView,
  id: ToolbarCommandId,
  inCell = false,
): MenuAction | null => {
  const cmd = BUILTIN_BY_ID[id]
  if (!cmd) return null
  const { disabled, active } = resolveForCell(view.state, cmd, inCell)
  return {
    label: cmd.title,
    icon: iconFor(id),
    active,
    disabled,
    onSelect: () => {
      cmd.run(view)
      view.focus()
    },
  }
}

export const actions = (
  view: EditorView,
  ids: ToolbarCommandId[],
  dropDisabled = false,
  inCell = false,
): MenuAction[] => {
  const out: MenuAction[] = []
  for (const id of ids) {
    const a = toAction(view, id, inCell)
    if (a && !(dropDisabled && a.disabled)) out.push(a)
  }
  return out
}

export const clipboardRows = (view: EditorView): MenuRow[] => {
  const doc = view.contentDOM.ownerDocument
  const exec = (cmd: "cut" | "copy") => () => {
    view.focus()
    try {
      doc.execCommand(cmd)
    } catch {
      /* not permitted — the keyboard shortcut still works */
    }
  }
  // Menu Paste needs async clipboard read; without it there is no user-gesture
  // path from a button. Rather than a live row that silently no-ops, show it
  // disabled and point at the shortcut, which always works.
  const clipboard = view.dom.ownerDocument.defaultView?.navigator?.clipboard
  const canPaste = typeof clipboard?.readText === "function"
  const paste = () => {
    const cell = activeTableCell(view)
    if (!cell) view.focus()
    clipboard
      ?.readText()
      .then((text) => {
        if (!text) return
        // Focus can move during the read (a permission prompt, a click
        // elsewhere, the view unmounting) — re-check before acting instead of
        // trusting the cell captured before the await.
        if (cell) {
          if (doc.activeElement === cell) doc.execCommand("insertText", false, text)
        } else if (view.hasFocus) {
          view.dispatch(view.state.replaceSelection(text))
        }
      })
      .catch(() => {
        /* clipboard read denied — the keyboard shortcut still works */
      })
  }
  return [
    { label: "Cut", icon: ICON_PATHS.cut, onSelect: exec("cut") },
    { label: "Copy", icon: ICON_PATHS.copy, onSelect: exec("copy") },
    canPaste
      ? { label: "Paste", icon: ICON_PATHS.paste, onSelect: paste }
      : {
          label: "Paste",
          icon: ICON_PATHS.paste,
          disabled: true,
          title: "Paste with the keyboard shortcut",
          onSelect: () => {},
        },
  ]
}

export const submenu = (
  label: string,
  icon: string | undefined,
  rows: MenuRow[],
  disabled = false,
): MenuSubmenu => ({ label, icon, rows, disabled })

/** Append `add` as its own separator-delimited group. */
export function pushGroup(rows: MenuRow[], add: MenuRow[]): void {
  if (!add.length) return
  if (rows.length) rows.push("separator")
  rows.push(...add)
}
