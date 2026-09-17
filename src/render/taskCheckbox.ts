import {
  Children,
  cloneElement,
  isValidElement,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import type { TaskToggleInfo } from "../types"

/**
 * A task-list item's own `[ ]` / `[x]` marker sits right after its bullet or
 * ordinal and indentation — nothing else can appear before it on the line.
 * Anchoring the match to the very start of the item's raw text (from mdast's
 * `position.start.offset`) makes this safe even when the item's own text
 * could otherwise read as another marker further into the line.
 */
const CHECKBOX_PREFIX = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([ xX])\]/

/**
 * Locates the exact `[ ]` / `[x]` substring of a task-list item within
 * `value`, given the raw offset where the item itself starts (a GFM
 * `listItem`'s `position.start.offset`, as parsed by `remark-gfm`).
 * Returns `null` if the prefix doesn't match a checkbox — it always should
 * for a node `remark-gfm` marked `checked`, but a raw markdown edit racing
 * the render is not impossible.
 */
export function findCheckboxOffsets(
  value: string,
  itemStart: number,
): { start: number; end: number } | null {
  const lineEnd = value.indexOf("\n", itemStart)
  const prefix = value.slice(itemStart, lineEnd === -1 ? value.length : lineEnd)
  const match = CHECKBOX_PREFIX.exec(prefix)
  if (!match) return null
  const start = itemStart + match[0].length - 3
  return { start, end: start + 3 }
}

/**
 * Builds the checkbox's `onChange` handler for a rendered `<li>`, or `null`
 * when it isn't an eligible task item — not a task list item at all,
 * `onTaskToggle` unset, no position data, or (a raw-edit race, effectively
 * never) a marker `findCheckboxOffsets` can't locate.
 */
export function makeToggleHandler(
  node: { position?: { start: { offset?: number } } } | undefined,
  className: string | undefined,
  value: string,
  onTaskToggle: ((info: TaskToggleInfo) => void) | undefined,
): ((event: ChangeEvent<HTMLInputElement>) => void) | null {
  if (!onTaskToggle || typeof className !== "string" || !className.includes("task-list-item")) {
    return null
  }
  const itemStart = node?.position?.start.offset
  if (itemStart === undefined) return null
  const offsets = findCheckboxOffsets(value, itemStart)
  if (!offsets) return null
  return (event) => onTaskToggle({ ...offsets, checked: event.target.checked })
}

/**
 * A task item's checkbox `<input>` is always the leftmost leaf of its `<li>`
 * — `mdast-util-to-hast` unshifts it onto the first paragraph, itself the
 * first result, whether or not GFM kept that paragraph wrapped (a "loose"
 * list, blank lines between items) or unwrapped it (a "tight" one). Walking
 * only the first-child spine finds it either way without ever wandering into
 * a nested sub-list's own checkbox, which lives as a later sibling, not a
 * descendant of the first child.
 */
export function enableLeadingCheckbox(
  node: ReactNode,
  onChange: (event: ChangeEvent<HTMLInputElement>) => void,
): { done: true; node: ReactNode } | { done: false } {
  if (!isValidElement(node)) return { done: false }
  if (node.type === "input") {
    return {
      done: true,
      node: cloneElement(node as ReactElement<Record<string, unknown>>, {
        disabled: false,
        onChange,
      }),
    }
  }
  const kids = Children.toArray((node.props as { children?: ReactNode }).children)
  if (kids.length === 0) return { done: false }
  const result = enableLeadingCheckbox(kids[0], onChange)
  if (!result.done) return { done: false }
  return {
    done: true,
    node: cloneElement(node as ReactElement<{ children?: ReactNode }>, {}, [
      result.node,
      ...kids.slice(1),
    ]),
  }
}
