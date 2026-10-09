---
title: "<StyloToolbarSettings /> — end-user toolbar customizer"
created: 2026-09-10
type: wiki-reference
parent: index
tags:
  - stylo/wiki
  - engineering/standard
---

# `<StyloToolbarSettings />`

An opt-in component that lets the **person using the editor** choose which formatting-bar buttons show and in what order. It is separate from the [developer toolbar API](./toolbar.md): the developer defines the palette of available buttons in code; this component lets the end user arrange a subset of it.

Imported from its own entry point so it never adds to a plain `@damiro/stylo` import:

```tsx
import { StyloToolbarSettings } from "@damiro/stylo/toolbar-settings"
import { Stylo } from "@damiro/stylo"
import "@damiro/stylo/styles.css"
```

### Extra install

The reordering drag is built on `@dnd-kit`. These three are **optional peer dependencies** — a plain `@damiro/stylo` install skips them; add them only if you render this component:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Controlled, like the editor

It edits the same `items` array `<Stylo>` takes. The host holds that array, persists it, and passes it to both:

```tsx
import { useState } from "react"
import { StyloToolbarSettings } from "@damiro/stylo/toolbar-settings"
import { Stylo } from "@damiro/stylo"

const DEFAULT = [
  "undo",
  "redo",
  "|",
  "h1",
  "h2",
  "h3",
  "|",
  "bold",
  "italic",
  "link",
  "|",
  "bulletList",
  "task",
]

function Editor() {
  const [items, setItems] = useState(() => load() ?? DEFAULT)
  const [doc, setDoc] = useState("")

  return (
    <>
      {/* in a settings dialog, a preferences pane, wherever */}
      <StyloToolbarSettings
        value={items}
        onChange={(next) => {
          setItems(next)
          save(next) // your own localStorage / prefs API
        }}
      />

      <Stylo value={doc} onChange={setDoc} toolbar={{ items }} />
    </>
  )
}
```

Stylo stores nothing and runs no persistence timer — `save` / `load` above are yours. See the [auto-save guide](../guides/autosave.md) for the same pattern applied to document content.

## Props

| Prop        | Type                                           | Default          | Notes                                                                                                                              |
| ----------- | ---------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `value`     | `ToolbarItem[]`                                | _required_       | The current bar — the same array passed to `<Stylo toolbar={{ items }}>`.                                                          |
| `onChange`  | `(next: ToolbarItem[]) => void`                | _required_       | Fired with the new array on every reorder, add, remove, or reset.                                                                  |
| `available` | `ToolbarItem[]`                                | all built-in ids | The full set the user may pick from. Pass your own to include [`ToolbarCustomItem`](./toolbar.md)s or to hold some built-ins back. |
| `icons`     | `Partial<Record<ToolbarCommandId, ReactNode>>` | built-in glyphs  | Per-id glyph overrides, matching `<Stylo icons>`.                                                                                  |
| `className` | `string`                                       | —                | Added to the root element.                                                                                                         |

## Interaction

Two lists:

- **On the bar** — the current `items`. **Reorder** by dragging a row's ⠿ handle, or focus the handle and press **Space** then the **Arrow keys** then **Space** to drop (`@dnd-kit`'s keyboard sensor). The ✕ button moves the row to Available. Below the list: **Add separator** appends a `"|"`, **Reset to default** restores the built-in set.
- **Available** — every palette entry not already on the bar. **Add** appends it.

Drag moves are announced by `@dnd-kit`'s own live region; the button actions (add, remove, reset) announce in a second `aria-live` region. A keyboard-only user can do everything.

## Styling

Structural CSS only; it reads the same `--stylo-*` tokens as the editor chrome, so it themes with it in light and dark. Override with your own rules on `className` or the component's elements.
