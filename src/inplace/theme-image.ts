/**
 * The inert slot a `![alt](src)` image renders into (`image.ts`); the host node
 * is portalled in by `InPlaceView`. Block flow with a little breathing room, as
 * `.cm-inplace-embed` has, but no left rail: a picture is not a quotation.
 * Padding, not margin, for the reason given at `.cm-inplace-embed` in
 * `theme-canvas.ts`. `.cm-inplace-image` is the consumer override hook. An image
 * in a sentence, a list item or a quote is a `<span class="cm-inplace-image-inline">`
 * left in the line, which needs no rule. Where a picture sits and how wide it may
 * grow come from the `imageAlign` and `imageWidth` props, in `stylo.module.css`.
 * See ADR-017.
 */
export const imageTheme = {
  ".cm-inplace-image": {
    display: "block",
    padding: "0.5em 0",
  },
}
