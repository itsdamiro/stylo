// Public entry point. Kept a thin barrel: re-exports and types only, no logic.
export { Stylo } from "./Stylo"
export { splitFrontmatter } from "./frontmatter"
export type {
  CodeLanguages,
  EmbedSource,
  FrontmatterDisplay,
  CellMark,
  CellWidget,
  InPlaceConfig,
  InPlaceDecorationToggles,
  ResolveErrorInfo,
  RevealMode,
  SelectionUI,
  StyloHandle,
  StyloMode,
  StyloProps,
  TableEditing,
  TagCompletion,
  TagSource,
  TaskToggleInfo,
  ToolbarCommandId,
  ToolbarConfig,
  ToolbarCustomItem,
  ToolbarItem,
  WikiLinkCompletion,
  WikiLinkSource,
} from "./types"
