/**
 * Re-export barrel over `types/`, split by domain: `core` (`StyloProps`),
 * `display` (the mode, frontmatter, code-language and task-toggle types),
 * `handle` (`StyloHandle`), `toolbar` (toolbar config), `sources`
 * (wikilink/tag/embed resolver types), and `inplace` (in-place canvas config).
 * Kept so nothing importing from `./types` today has to change.
 */
export type { StyloMode, FrontmatterDisplay, CodeLanguages, TaskToggleInfo } from "./types/display"
export type { StyloProps } from "./types/core"
export type { StyloHandle } from "./types/handle"
export type {
  ToolbarCommandId,
  ToolbarCustomItem,
  ToolbarItem,
  ToolbarConfig,
} from "./types/toolbar"
export type { WikiLinkCompletion, WikiLinkSource, TagCompletion, TagSource } from "./types/sources"
export type { EmbedSource, ImageSource, ResolveErrorInfo } from "./types/sources"
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
