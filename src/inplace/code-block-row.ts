/**
 * The fenced code block's row in the in-place right-click menu: an editable
 * info string and **Remove code block**.
 */

import type { EditorView } from "@codemirror/view"
import { BUILTIN_BY_ID } from "../toolbar/commands"
import { fenceInfoAt } from "../toolbar/fence"
import { ICON_PATHS } from "../toolbar/icon-paths"
import type { MenuField } from "./context-menu"

/**
 * The "Language" row shown when the caret is in a fenced code block: an
 * editable info string (` ```ts `), plus **Remove code block** to unwrap it.
 * The opening fence line is hidden in the seamless canvas, so this is the way
 * to reach the language at all.
 */
export function codeBlockRow(view: EditorView): MenuField {
  const info = fenceInfoAt(view.state)
  return {
    field: true,
    label: "Language",
    icon: ICON_PATHS.codeBlock,
    value: info?.lang ?? "",
    placeholder: "ts, python, …",
    onSubmit: (lang) => {
      if (info) view.dispatch({ changes: { from: info.from, to: info.to, insert: lang.trim() } })
      view.focus()
    },
    actions: [
      {
        label: "Remove code block",
        onSelect: () => {
          BUILTIN_BY_ID.codeBlock?.run(view)
          view.focus()
        },
      },
    ],
  }
}
