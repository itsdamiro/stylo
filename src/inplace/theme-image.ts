/**
 * The inert slot a `![alt](src)` image renders into (`image.ts`); the host node
 * is portalled in by `InPlaceView`. Block flow with a little breathing room, as
 * `.cm-inplace-embed` has, but no left rail: a picture is not a quotation.
 * Padding, not margin, for the reason given at `.cm-inplace-embed` in
 * `theme-canvas.ts`. `.cm-inplace-image` is the consumer override hook.
 */
export const imageTheme = {
  ".cm-inplace-image": {
    display: "block",
    padding: "0.5em 0",
  },
}
