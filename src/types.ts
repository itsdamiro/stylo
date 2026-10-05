/**
 * Re-export barrel over `types/`, split by domain: `core` (`StyloProps`,
 * `StyloHandle`, and the top-level display/mode types), `toolbar` (toolbar
 * config), `sources` (wikilink/tag/embed resolver types), and `inplace`
 * (in-place canvas config). Kept so nothing importing from `./types` today
 * has to change.
 */
export type {
  StyloMode,
  FrontmatterDisplay,
  CodeLanguages,
  TaskToggleInfo,
  StyloProps,
  StyloHandle,
} from "./types/core"
export type {
  ToolbarCommandId,
  ToolbarCustomItem,
  ToolbarItem,
  ToolbarConfig,
} from "./types/toolbar"
export type { WikiLinkCompletion, WikiLinkSource, TagCompletion, TagSource } from "./types/sources"
export type { EmbedSource, ResolveErrorInfo } from "./types/sources"
export type {
  InPlaceDecorationToggles,
  TableEditing,
  RevealMode,
  SelectionUI,
  MenuGroupId,
  ContextMenuConfig,
  CellMark,
  CellWidget,
  ContextMenuItem,
  InPlaceConfig,
} from "./types/inplace"
