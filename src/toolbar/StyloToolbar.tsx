import type { EditorView } from "@codemirror/view"
import type { StyloProps } from "../types"
import { resolveToolbarItems } from "./config"
import { Toolbar } from "./Toolbar"

/** The window edge a `toolbar.sticky` config pins the bar to, or `false`. */
export function stickyEdge(toolbar: StyloProps["toolbar"]): "top" | "bottom" | false {
  const sticky = toolbar && typeof toolbar === "object" ? toolbar.sticky : undefined
  return sticky === "top" ? "top" : sticky ? "bottom" : false
}

interface StyloToolbarProps {
  view: EditorView | null
  toolbar: StyloProps["toolbar"]
  icons: StyloProps["icons"]
  readOnly: boolean | undefined
  /** `preview` has no editing surface, so no bar. */
  hidden: boolean
}

/** Resolves the toolbar config and draws the bar, through a host's `render` when it gives one. */
export function StyloToolbar({ view, toolbar, icons, readOnly, hidden }: StyloToolbarProps) {
  const items = hidden ? null : resolveToolbarItems(toolbar)
  if (!items) return null
  const config = toolbar && typeof toolbar === "object" ? toolbar : undefined
  const bar = (
    <Toolbar
      view={view}
      items={items}
      icons={icons}
      disabled={readOnly}
      sticky={stickyEdge(toolbar)}
      stickyVisibility={config?.stickyVisibility}
      overflow={config?.overflow}
      overflowIcon={config?.overflowIcon}
    />
  )
  return config?.render ? config.render(bar, { view }) : bar
}
