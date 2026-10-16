import type { Language, LanguageDescription } from "@codemirror/language"

export type StyloMode = "in-place" | "source" | "preview" | "split"

/**
 * How `preview` (and the preview pane of `split`) treats the leading `---` YAML
 * block. `"hidden"` (default) drops it from the render; `"code"` renders it as a
 * styled `<div class="stylo-frontmatter">` a consumer can restyle with its own
 * CSS. A parsed key/value panel is deferred (ADR-001, needs a YAML parser).
 */
export type FrontmatterDisplay = "hidden" | "code"

/**
 * Grammars for fenced-code sub-highlighting. Stylo ships none by default — a
 * consumer opts in with exactly the set they want (`codeLanguages={languages}`
 * from `@codemirror/language-data`, or a hand-built list). Forwarded verbatim
 * to `@codemirror/lang-markdown` for the CodeMirror surfaces (`source`,
 * `split`, `in-place`); `preview` resolves a fence's language the same way
 * (same fuzzy `LanguageDescription` match, or the function form called with
 * the same name) and colours it with the same `--stylo-syntax-*` tokens, so a
 * block reads identically whether it's being read or edited. See the ADR-001
 * amendment and ADR-002 §3's 2026-09-13 amendment.
 */
export type CodeLanguages =
  readonly LanguageDescription[] | ((info: string) => Language | LanguageDescription | null)

/**
 * Reported by `onTaskToggle` when a `preview` task-list checkbox is clicked.
 * `start`/`end` are raw offsets into `value` bracketing the `[ ]` / `[x]`
 * marker itself (`end - start === 3`); splice in the new marker text to apply
 * the toggle: `value.slice(0, start) + (checked ? "[x]" : "[ ]") +
 * value.slice(end)`. `checked` is the box's new state, not its state before
 * the click.
 */
export interface TaskToggleInfo {
  /** Offset of the marker's opening `[` in `value`. */
  start: number
  /** Offset just past the marker's closing `]` in `value`. */
  end: number
  /** The checkbox's new state. */
  checked: boolean
}
