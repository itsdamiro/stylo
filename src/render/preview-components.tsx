import { Children, isValidElement, type ReactNode } from "react"
import type { Components } from "react-markdown"
import type { CodeLanguages, EmbedSource, ResolveErrorInfo, TaskToggleInfo } from "../types"
import { CodeBlock } from "./CodeBlock"
import { Embed } from "./Embed"
import { enableLeadingCheckbox, makeToggleHandler } from "./taskCheckbox"

export interface PreviewComponentsOptions {
  /** Read at click time, not baked into the closure — kept fresh across
   *  re-renders without forcing `buildPreviewComponents` itself to depend on
   *  `value` (which changes every keystroke and would defeat memoizing it). */
  valueRef: { current: string }
  onWikiLinkClick?: (target: string) => void
  embedSource?: EmbedSource
  onResolveError?: (error: unknown, info: ResolveErrorInfo) => void
  codeLanguages?: CodeLanguages
  onTaskToggle?: (info: TaskToggleInfo) => void
}

/** One `data-*` attribute off a component's spread props, as a string. */
function dataAttr(rest: object, key: string): string | undefined {
  const v = (rest as Record<string, unknown>)[key]
  return typeof v === "string" ? v : undefined
}

/** The `![[ref]]` embed for a `data-stylo-embed(-inline)` node, or `children` unchanged. */
function embedOrChildren(
  reference: string | undefined,
  embedSource: EmbedSource | undefined,
  onResolveError: PreviewComponentsOptions["onResolveError"],
  inline: boolean,
  children: ReactNode,
): ReactNode {
  if (reference === undefined || !embedSource) return children
  return (
    <Embed reference={reference} source={embedSource} onError={onResolveError} inline={inline} />
  )
}

/**
 * Builds `react-markdown`'s `components` map for `Preview`: the wikilink
 * click handler on `a`, the embed slots on `div` / `span`, the task-checkbox
 * wiring on `li`, the table wrapper, and fenced-code highlighting.
 */
export function buildPreviewComponents({
  valueRef,
  onWikiLinkClick,
  embedSource,
  onResolveError,
  codeLanguages,
  onTaskToggle,
}: PreviewComponentsOptions): Components {
  return {
    a({ node: _node, children, ...rest }) {
      const target = dataAttr(rest, "data-wikilink")
      if (target !== undefined) {
        return (
          <a
            {...rest}
            href="#"
            onClick={(event) => {
              event.preventDefault()
              onWikiLinkClick?.(target)
            }}
          >
            {children}
          </a>
        )
      }
      return (
        <a {...rest} rel="noreferrer">
          {children}
        </a>
      )
    },
    div({ node: _node, children, ...rest }) {
      return (
        <div {...rest}>
          {embedOrChildren(
            dataAttr(rest, "data-stylo-embed"),
            embedSource,
            onResolveError,
            false,
            children,
          )}
        </div>
      )
    },
    span({ node: _node, children, ...rest }) {
      return (
        <span {...rest}>
          {embedOrChildren(
            dataAttr(rest, "data-stylo-embed-inline"),
            embedSource,
            onResolveError,
            true,
            children,
          )}
        </span>
      )
    },
    li({ node, children, ...rest }) {
      const handleToggle = makeToggleHandler(node, rest.className, valueRef.current, onTaskToggle)
      if (handleToggle) {
        // A loose list (blank line between items) keeps the `<li>`'s content
        // wrapped in a `<p>`, itself preceded by a formatting `"\n"` text
        // node — skip past that to the first real element.
        const kids = Children.toArray(children)
        const firstElementIndex = kids.findIndex((kid) => isValidElement(kid))
        const enabled =
          firstElementIndex === -1
            ? null
            : enableLeadingCheckbox(kids[firstElementIndex], handleToggle)
        if (enabled?.done) {
          const nextKids: ReactNode[] = kids.map((kid, i) =>
            i === firstElementIndex ? enabled.node : kid,
          )
          return <li {...rest}>{nextKids}</li>
        }
      }
      return <li {...rest}>{children}</li>
    },
    table({ node: _node, children, ...rest }) {
      return (
        <div className="stylo-table-wrap">
          <table {...rest}>{children}</table>
        </div>
      )
    },
    code({ node: _node, className, children, ...rest }) {
      const language = /language-(\w+)/.exec(className || "")?.[1]
      if (language && codeLanguages) {
        return (
          <CodeBlock
            className={className}
            language={language}
            code={String(children).replace(/\n$/, "")}
            codeLanguages={codeLanguages}
          />
        )
      }
      return (
        <code {...rest} className={className}>
          {children}
        </code>
      )
    },
  }
}
