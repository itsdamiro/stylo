import { type EditorState, Facet } from "@codemirror/state"
import type {
  CellMark,
  ContextMenuItem,
  InPlaceConfig,
  InPlaceDecorationToggles,
  MenuGroupId,
  RevealMode,
  SelectionUI,
  TableEditing,
  ToolbarCommandId,
} from "../types"
import type { EmbedRegistry } from "./embed-registry"

/** `InPlaceDecorationToggles` with every key resolved to a concrete boolean. */
export type ResolvedToggles = Required<InPlaceDecorationToggles>

const DEFAULT_TOGGLES: ResolvedToggles = {
  headings: true,
  emphasis: true,
  links: true,
  wikilinks: true,
  math: true,
  lists: true,
  tasks: true,
  blockquote: true,
  horizontalRule: true,
  code: true,
  frontmatter: true,
  tables: true,
  embeds: true,
}

export function resolveToggles(config?: InPlaceConfig): ResolvedToggles {
  return { ...DEFAULT_TOGGLES, ...config?.decorations }
}

/**
 * Carries the resolved decoration toggles to every producer (the view plugin
 * and the three state fields). Seeded once by `inPlaceExtension`; read, never
 * written, by `decorate.ts`, `math.ts`, `frontmatter.ts`, and `tables.ts`.
 */
export const inPlaceConfigFacet = Facet.define<ResolvedToggles, ResolvedToggles>({
  combine: (values) => values[0] ?? DEFAULT_TOGGLES,
})

/**
 * The per-canvas `EmbedRegistry`, or `null` when the host passed no
 * `embedSource`. Seeded once by `inPlaceExtension`; read by `embed.ts` (to gate
 * the pass and hand the widget its registry) and `wikilinks.ts` (to yield the
 * `[[ref]]` inside a `![[ref]]` to the embed pass). See ADR-009.
 */
export const embedRegistryFacet = Facet.define<EmbedRegistry | null, EmbedRegistry | null>({
  combine: (values) => values[0] ?? null,
})

/** Table editing mode, seeded once by `inPlaceExtension`; read by `tables.ts`. */
export const tableEditingFacet = Facet.define<TableEditing, TableEditing>({
  combine: (values) => values[0] ?? "source",
})

/**
 * Marker reveal behaviour (ADR-007). `"never"` makes `decorate.ts` hide every
 * inline marker regardless of the caret line. Seeded once by `inPlaceExtension`.
 */
export const revealModeFacet = Facet.define<RevealMode, RevealMode>({
  combine: (values) => values[0] ?? "caret",
})

/**
 * The host's `onLinkClick` (the "Open link" action in the right-click link
 * editor), or `null`. Seeded once by `inPlaceExtension`.
 */
export const linkOpenFacet = Facet.define<
  ((href: string) => void) | null,
  ((href: string) => void) | null
>({
  combine: (values) => values[0] ?? null,
})

/**
 * Whether the right-click menu takes over from the browser's own context menu
 * in the canvas. Seeded once by `inPlaceExtension`; read by `menu-plugin.ts`.
 */
export const contextMenuEnabled = Facet.define<boolean, boolean>({
  combine: (values) => values[0] ?? true,
})

/** The menu's groups in their default order. */
export const DEFAULT_MENU_GROUPS: MenuGroupId[] = [
  "host",
  "link",
  "format",
  "paragraph",
  "insert",
  "clipboard",
]

/** The selection bar's buttons in their default order. */
export const DEFAULT_SELECTION_BAR_ITEMS: ToolbarCommandId[] = [
  "bold",
  "italic",
  "strike",
  "code",
  "link",
  "wikilink",
  "math",
]

/** `enabled` false keeps the browser menu; `groups` is always a non-empty list. */
export function resolveContextMenu(c: InPlaceConfig["contextMenu"]): {
  enabled: boolean
  groups: MenuGroupId[]
  items: ContextMenuItem[]
} {
  if (c === false) return { enabled: false, groups: [], items: [] }
  if (c == null || c === true) return { enabled: true, groups: DEFAULT_MENU_GROUPS, items: [] }
  return {
    enabled: true,
    groups: c.groups?.length ? c.groups : DEFAULT_MENU_GROUPS,
    items: c.items ?? [],
  }
}

/**
 * The host's right-click entries (`contextMenu.items`), as a getter so the
 * canvas can hand it a ref and a re-render's new `run` closures are used.
 * Seeded by `inPlaceExtension`.
 */
export const hostItemsFacet = Facet.define<() => ContextMenuItem[], () => ContextMenuItem[]>({
  combine: (values) => values[0] ?? (() => []),
})

/** The host's `inPlace.cellMarks`, or none. Seeded by `inPlaceExtension`. */
export const cellMarksFacet = Facet.define<
  (state: EditorState) => readonly CellMark[],
  (state: EditorState) => readonly CellMark[]
>({
  combine: (values) => values[0] ?? (() => []),
})

/**
 * Ordered right-click menu groups. Seeded once by `inPlaceExtension`; read by
 * `context-menu-actions.ts`.
 */
export const menuGroupsFacet = Facet.define<MenuGroupId[], MenuGroupId[]>({
  combine: (values) => values[0] ?? DEFAULT_MENU_GROUPS,
})

/** Selection-bar buttons, resolved to the known inline ids in the given order. */
export function resolveSelectionBarItems(ids?: ToolbarCommandId[]): ToolbarCommandId[] {
  if (!ids?.length) return DEFAULT_SELECTION_BAR_ITEMS
  const kept = ids.filter((id) => DEFAULT_SELECTION_BAR_ITEMS.includes(id))
  return kept.length ? kept : DEFAULT_SELECTION_BAR_ITEMS
}

/**
 * Ordered selection-bar button ids. Seeded once by `inPlaceExtension`; read by
 * `selection-bar.ts`.
 */
export const selectionBarItemsFacet = Facet.define<ToolbarCommandId[], ToolbarCommandId[]>({
  combine: (values) => values[0] ?? DEFAULT_SELECTION_BAR_ITEMS,
})

/**
 * What a non-empty selection offers (ADR-007). `"bar"` shows the floating
 * formatting bar; `"menu"` (default) keeps the inline group in the right-click
 * menu instead; `"none"` shows neither. Seeded once by `inPlaceExtension`; read
 * by `selection-bar.ts` and `context-menu-actions.ts`.
 */
export const selectionUIFacet = Facet.define<SelectionUI, SelectionUI>({
  combine: (values) => values[0] ?? "menu",
})
